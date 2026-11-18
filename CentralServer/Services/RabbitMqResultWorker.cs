using CentralServer.Data;
using CentralServer.Models;
using Microsoft.EntityFrameworkCore;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using System.Net.Http;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace CentralServer.Services;

public class RabbitMqResultWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IConfiguration _config;
    private readonly ILogger<RabbitMqResultWorker> _logger;

    public RabbitMqResultWorker(IServiceScopeFactory scopeFactory, IConfiguration config, ILogger<RabbitMqResultWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _config = config;
        _logger = logger;
    }

    // HTTP-клиент для получения информации из Wikipedia
    private static readonly HttpClient WikipediaClient = new()
    {
        Timeout = TimeSpan.FromSeconds(8)
    };

    // Получение описания распознанной птицы
    private async Task<(string Description, string SourceUrl)?>
        GetBirdInfoFromWikipediaAsync(string birdName)
    {
        try
        {
            var url =
                "https://en.wikipedia.org/w/api.php" +
                "?action=query" +
                "&prop=extracts" +
                "&exintro=1" +
                "&explaintext=1" +
                "&format=json" +
                "&formatversion=2" +
                "&titles=" + Uri.EscapeDataString(birdName);
            using var request = new HttpRequestMessage(
                HttpMethod.Get,
                url
            );
            request.Headers.TryAddWithoutValidation(
                "User-Agent",
                "AIBirdLab/1.0 (contact: vikmel005@gmail.com)"
            );
            using var response = await WikipediaClient.SendAsync(request);
            response.EnsureSuccessStatusCode();
            using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            var pages = document.RootElement
                .GetProperty("query")
                .GetProperty("pages");
            if (pages.GetArrayLength() == 0)
                return null;
            var page = pages[0];
            if (page.TryGetProperty("missing", out _))
                return null;
            if (!page.TryGetProperty("title", out var titleElement))
                return null;
            var title = titleElement.GetString();
            if (!string.Equals(title, birdName, StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogWarning(
                    "Wikipedia title mismatch: AI={Bird}, Wikipedia={Title}",
                    birdName,
                    title
                );
                return null;
            }
            if (!page.TryGetProperty("extract", out var extract))
                return null;
            var description = extract.GetString();
            if (string.IsNullOrWhiteSpace(description))
                return null;
            description = description.Trim();
            // Ограничиваем длину сохраняемого описания
            if (description.Length > 450)
            {
                description = description[..450];
            }
            var sourceUrl =
                "https://en.wikipedia.org/wiki/" +
                Uri.EscapeDataString(
                    title!.Replace(' ', '_')
                );
            return (description, sourceUrl);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex,
                "Wikipedia lookup failed for {Bird}",
                birdName
            );
            return null;
        }
    }

    // Получение результатов от RabbitMQ
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var factory = new ConnectionFactory
                {
                    HostName = _config["RabbitMQ:Host"] ?? "localhost",
                    Port = _config.GetValue<int?>("RabbitMQ:Port") ?? 5672,
                    UserName = _config["RabbitMQ:UserName"] ?? "guest",
                    Password = _config["RabbitMQ:Password"] ?? "guest",
                    DispatchConsumersAsync = true,
                    AutomaticRecoveryEnabled = true
                };
                using var connection = factory.CreateConnection();
                using var channel = connection.CreateModel();
                channel.QueueDeclare(
                    queue: "bird.analysis.results",
                    durable: true,
                    exclusive: false,
                    autoDelete: false,
                    arguments: null
                );
                channel.BasicQos(0, 1, false);
                var consumer = new AsyncEventingBasicConsumer(channel);
                consumer.Received += async (_, message) =>
                {
                    try
                    {
                        await SaveResultAsync(message.Body.ToArray());
                        channel.BasicAck(
                            message.DeliveryTag,
                            false
                        );
                    }
                    catch (JsonException ex)
                    {
                        _logger.LogError(
                            ex,
                            "Invalid result message"
                        );
                        channel.BasicReject(
                            message.DeliveryTag,
                            requeue: false
                        );
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(
                            ex,
                            "Cannot save AI result"
                        );
                        await Task.Delay(2000);
                        if (channel.IsOpen)
                        {
                            channel.BasicNack(
                                message.DeliveryTag,
                                multiple: false,
                                requeue: true
                            );
                        }
                    }
                };
                channel.BasicConsume(
                    queue: "bird.analysis.results",
                    autoAck: false,
                    consumer: consumer
                );
                _logger.LogInformation("Waiting for AI results...");
                await Task.Delay(
                    Timeout.Infinite,
                    stoppingToken
                );
            }
            catch (OperationCanceledException)
                when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex,
                    "RabbitMQ connection error"
                );
                await Task.Delay(5000, stoppingToken);
            }
        }
    }

    // Сохранение результата распознавания в MSSQL
    private async Task SaveResultAsync(byte[] body)
    {
        var result = JsonSerializer.Deserialize<AnalysisResult>(body);
        if (result == null || !int.TryParse(result.JobId, out int analysisId))
        {
            throw new JsonException("Invalid analysis ID");
        }
        using var scope = _scopeFactory.CreateScope();
        if (result.Status == "failed")
        {
            var service = scope.ServiceProvider.GetRequiredService<BirdAnalysisService>();
            await service.MarkFailedAsync(analysisId);
            return;
        }
        if (result.Status != "completed" || result.Top3 == null || result.Top3.Count < 3)
        {
            throw new JsonException("Invalid AI result");
        }
        var predictions = result.Top3.Take(3).ToList();
        foreach (var prediction in predictions)
        {
            if (string.IsNullOrWhiteSpace(prediction.Species) || prediction.Species.Length > 200 || !double.IsFinite(prediction.Confidence) || prediction.Confidence < 0 || prediction.Confidence > 1)
            {
                throw new JsonException("Invalid prediction");
            }
        }
        var db = scope.ServiceProvider.GetRequiredService<BirdLabDbContext>();
        var analysis = await db.BirdAnalyses
            .Include(a => a.Predictions)
            .FirstOrDefaultAsync(
                a => a.Id == analysisId
            );
        if (analysis == null || analysis.Status != "Pending")
        {
            return;
        }
        // Сохраняем три результата AI
        for (int i = 0; i < predictions.Count; i++)
        {
            analysis.Predictions.Add(
                new BirdPrediction
                {
                    AnalysisId = analysis.Id,
                    BirdName = predictions[i].Species!,
                    Confidence = predictions[i].Confidence,
                    Rank = i + 1
                }
            );
        }
        // Самая вероятная птица
        string birdName = predictions[0].Species!;
        // Сначала проверяем наличие птицы в нашей базе
        var birdInfo = await db.BirdInfo.FirstOrDefaultAsync(b => b.EnglishName == birdName);
        // Если записи нет, получаем описание из Wikipedia
        if (birdInfo == null)
        {
            var wikipediaInfo = await GetBirdInfoFromWikipediaAsync(birdName);
            if (wikipediaInfo == null)
            {
                _logger.LogWarning("No Wikipedia information found for bird: {Bird}", birdName);
            }
            else
            {
                _logger.LogInformation("Wikipedia information found for bird: {Bird}", birdName);
            }
            if (wikipediaInfo != null)
            {
                birdInfo = new BirdInfo
                {
                    EnglishName = birdName,
                    Description = wikipediaInfo.Value.Description,
                    SourceUrl = wikipediaInfo.Value.SourceUrl
                };
                db.BirdInfo.Add(birdInfo);
                await db.SaveChangesAsync();
            }
        }
        analysis.BirdInfoId = birdInfo?.Id;
        analysis.Status = "Completed";
        analysis.AnalysisDate = result.AnalysisDate?.UtcDateTime ?? DateTime.UtcNow;
        await db.SaveChangesAsync();
        _logger.LogInformation(
            "Analysis {Id} completed: {Bird}",
            analysis.Id,
            birdName
        );
    }

    // Формат сообщения от Python AI Worker
    private class AnalysisResult
    {
        [JsonPropertyName("job_id")]
        public string? JobId { get; set; }

        [JsonPropertyName("status")]
        public string? Status { get; set; }

        [JsonPropertyName("top_3")]
        public List<PredictionResult>? Top3 { get; set; }

        [JsonPropertyName("analysis_date")]
        public DateTimeOffset? AnalysisDate { get; set; }
    }

    private class PredictionResult
    {
        [JsonPropertyName("species")]
        public string? Species { get; set; }

        [JsonPropertyName("confidence")]
        public double Confidence { get; set; }
    }
}

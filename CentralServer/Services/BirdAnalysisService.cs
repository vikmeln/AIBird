using CentralServer.Data;
using CentralServer.Models;
using Microsoft.EntityFrameworkCore;

namespace CentralServer.Services;

public class BirdAnalysisService
{
    private readonly BirdLabDbContext _db;
    private readonly RabbitMqService _rabbitMq;
    private readonly string _uploadsPath;

    public BirdAnalysisService(BirdLabDbContext db, RabbitMqService rabbitMq, IConfiguration config, IWebHostEnvironment environment)
    {
        _db = db;
        _rabbitMq = rabbitMq;
        string folder = config["Uploads:Path"] ?? "../uploads";
        _uploadsPath = Path.GetFullPath(Path.IsPathRooted(folder) ? folder : Path.Combine(environment.ContentRootPath, folder)
        );
    }

    // Загрузка фотографии и создание анализа
    public async Task<BirdAnalysis?> CreateAsync(int userId, IFormFile file)
    {
        if (file == null || file.Length == 0)
            throw new ArgumentException("Выберите фотографию");
        if (file.Length > 10 * 1024 * 1024)
            throw new ArgumentException("Максимальный размер — 10 МБ");
        string fileName = Path.GetFileName(
            file.FileName.Replace("\\", "/")
        );
        if (string.IsNullOrWhiteSpace(fileName) || fileName.Length > 255)
            throw new ArgumentException("Некорректное имя файла");
        string extension = Path.GetExtension(fileName).ToLower();
        if (extension != ".jpg" && extension != ".jpeg" && extension != ".png")
            throw new ArgumentException("Допустимы только JPG и PNG");
        // Читаем фотографию
        using var stream = new MemoryStream();
        await file.CopyToAsync(stream);
        byte[] bytes = stream.ToArray();
        if (bytes.Length > 10 * 1024 * 1024)
            throw new ArgumentException("Файл слишком большой");
        // Проверяем формат файла
        bool jpeg = bytes.Length >= 3 &&
            bytes[0] == 0xFF &&
            bytes[1] == 0xD8 &&
            bytes[2] == 0xFF;
        byte[] pngHeader = { 137, 80, 78, 71, 13, 10, 26, 10 };
        bool png = bytes.Length >= 8 && bytes.Take(8).SequenceEqual(pngHeader);
        if ((extension == ".png" && !png) || (extension != ".png" && !jpeg))
            throw new ArgumentException("Некорректное изображение");
        Directory.CreateDirectory(_uploadsPath);
        var analysis = new BirdAnalysis
        {
            UserId = userId,
            FileName = fileName,
            SavedFileName = "pending",
            Status = "Pending",
            CreatedAt = DateTime.UtcNow
        };
        string? filePath = null;
        // Транзакция для сохранения анализа и попытки
        await using (var transaction = await _db.Database.BeginTransactionAsync())
        {
            try
            {
                // Пробуем использовать бесплатную попытку
                int freeUpdated = await _db.Users
                    .Where(u => u.Id == userId && u.FreeAttemptsUsed < 5)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(
                            u => u.FreeAttemptsUsed,
                            u => u.FreeAttemptsUsed + 1));
                if (freeUpdated > 0)
                {
                    analysis.AttemptType = "Free";
                }
                else
                {
                    // Проверяем оплаченные попытки
                    int paidUpdated = await _db.Users
                        .Where(u => u.Id == userId && u.PaidAttemptsLeft > 0)
                        .ExecuteUpdateAsync(s => s
                            .SetProperty(
                                u => u.PaidAttemptsLeft,
                                u => u.PaidAttemptsLeft - 1));
                    if (paidUpdated == 0)
                    {
                        await transaction.RollbackAsync();
                        return null;
                    }
                    analysis.AttemptType = "Paid";
                }
                _db.BirdAnalyses.Add(analysis);
                await _db.SaveChangesAsync();
                // Даём фотографии уникальное имя по ID
                analysis.SavedFileName = $"{analysis.Id}{extension}";
                filePath = Path.Combine(
                    _uploadsPath,
                    analysis.SavedFileName
                );
                await File.WriteAllBytesAsync(
                    filePath, bytes
                );
                await _db.SaveChangesAsync();
                await transaction.CommitAsync();
            }
            catch
            {
                await transaction.RollbackAsync();
                if (filePath != null && File.Exists(filePath))
                    File.Delete(filePath);
                throw;
            }
        }
        // Отправляем задание через RabbitMQ
        try
        {
            _rabbitMq.SendAnalysis(analysis);
        }
        catch
        {
            await MarkFailedAsync(analysis.Id);
            throw new InvalidOperationException("Ошибка отправки задания в RabbitMQ");
        }
        return analysis;
    }

    // Возвращаем попытку при неудачном анализе
    public async Task MarkFailedAsync(int analysisId)
    {
        await using var transaction = await _db.Database.BeginTransactionAsync();
        var analysis = await _db.BirdAnalyses
            .AsNoTracking()
            .FirstOrDefaultAsync(a => a.Id == analysisId);
        if (analysis == null)
            return;
        // Обновляем только незавершённый анализ
        int updated = await _db.BirdAnalyses
            .Where(a => a.Id == analysisId &&
                        a.Status == "Pending")
            .ExecuteUpdateAsync(s => s
                .SetProperty(a => a.Status, "Failed")
                .SetProperty(
                    a => a.AnalysisDate,
                    DateTime.UtcNow));
        if (updated == 0)
            return;
        // Возвращаем бесплатную или платную попытку
        if (analysis.AttemptType == "Free")
        {
            await _db.Users
                .Where(u => u.Id == analysis.UserId)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(
                        u => u.FreeAttemptsUsed,
                        u => u.FreeAttemptsUsed - 1));
        }
        else if (analysis.AttemptType == "Paid")
        {
            await _db.Users
                .Where(u => u.Id == analysis.UserId)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(
                        u => u.PaidAttemptsLeft,
                        u => u.PaidAttemptsLeft + 1));
        }
        await transaction.CommitAsync();
    }

    // Путь к фотографии для галереи
    public string GetImagePath(string savedFileName)
    {
        if (string.IsNullOrWhiteSpace(savedFileName) || savedFileName.Contains('/') || savedFileName.Contains('\\'))
            throw new ArgumentException("Некорректное имя файла");
        return Path.Combine(_uploadsPath, savedFileName);
    }
}

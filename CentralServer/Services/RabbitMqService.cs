using CentralServer.Models;
using RabbitMQ.Client;
using System.Text.Json;

namespace CentralServer.Services;

public class RabbitMqService
{
    private readonly ConnectionFactory _factory;

    public RabbitMqService(IConfiguration config)
    {
        _factory = new ConnectionFactory
        {
            HostName = config["RabbitMQ:Host"] ?? "localhost",
            Port = config.GetValue<int?>("RabbitMQ:Port") ?? 5672,
            UserName = config["RabbitMQ:UserName"] ?? "guest",
            Password = config["RabbitMQ:Password"] ?? "guest"
        };
    }

    // Отправка задания в Python AI Worker
    public void SendAnalysis(BirdAnalysis analysis)
    {
        using var connection = _factory.CreateConnection();
        using var channel = connection.CreateModel();
        channel.QueueDeclare(
            queue: "bird.analysis.requests",
            durable: true,
            exclusive: false,
            autoDelete: false,
            arguments: null
        );
        channel.QueueDeclare(
            queue: "bird.analysis.results",
            durable: true,
            exclusive: false,
            autoDelete: false,
            arguments: null
        );
        channel.ConfirmSelect();
        var message = new
        {
            job_id = analysis.Id.ToString(),
            image_name = analysis.FileName,
            stored_filename = analysis.SavedFileName
        };
        byte[] body = JsonSerializer.SerializeToUtf8Bytes(message);
        var properties = channel.CreateBasicProperties();
        properties.ContentType = "application/json";
        properties.DeliveryMode = 2;
        channel.BasicPublish(
            exchange: "",
            routingKey: "bird.analysis.requests",
            mandatory: true,
            basicProperties: properties,
            body: body
        );
        channel.WaitForConfirmsOrDie(TimeSpan.FromSeconds(10));
    }
}

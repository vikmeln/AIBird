using CentralServer.Data;
using CentralServer.Models;
using CentralServer.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Moq;
using System.Security.Claims;

namespace CentralServer.Tests;

public sealed class TestSupport : IDisposable
{
    private readonly SqliteConnection _connection;

    public BirdLabDbContext Db { get; }
    public IConfiguration Config { get; }
    public string TempPath { get; }

    public TestSupport()
    {
        _connection = new SqliteConnection("Data Source=:memory:");
        _connection.Open();
        var options = new DbContextOptionsBuilder<BirdLabDbContext>()
            .UseSqlite(_connection)
            .Options;
        Db = new BirdLabDbContext(options);
        Db.Database.EnsureCreated();
        TempPath = Path.Combine(
            Path.GetTempPath(),
            "AIBirdTests",
            Guid.NewGuid().ToString("N")
        );
        Directory.CreateDirectory(TempPath);
        Config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Uploads:Path"] = TempPath,
                ["Jwt:Key"] = "AIBirdLab.TestSecretKey.ForUnitTests.Only.2026!",
                ["Jwt:Issuer"] = "AIBirdLab.Tests",
                ["Jwt:Audience"] = "AIBirdLab.Client",
                ["Blockchain:RpcUrl"] = "http://127.0.0.1:1",
                ["Blockchain:ContractAddress"] = "0x5FbDB2315678afecb367f032d93F642f64180aa3",
                ["Blockchain:ChainId"] = "31337"
            })
            .Build();
    }

    public BirdAnalysisService CreateAnalysisService()
    {
        var environment = new Mock<IWebHostEnvironment>();
        environment
            .SetupGet(e => e.ContentRootPath)
            .Returns(TempPath);
        return new BirdAnalysisService(
            Db,
            new RabbitMqService(Config),
            Config,
            environment.Object
        );
    }

    public User AddUser(int freeUsed = 0, int paidLeft = 0)
    {
        string email = $"{Guid.NewGuid():N}@example.test";
        var user = new User
        {
            UserName = email,
            Email = email,
            FreeAttemptsUsed = freeUsed,
            PaidAttemptsLeft = paidLeft
        };
        Db.Users.Add(user);
        Db.SaveChanges();
        return user;
    }

    public BirdAnalysis AddAnalysis(User user, string status = "Pending", string attemptType = "Free")
    {
        var analysis = new BirdAnalysis
        {
            UserId = user.Id,
            FileName = "bird.jpg",
            SavedFileName = "bird.jpg",
            Status = status,
            AttemptType = attemptType
        };
        Db.BirdAnalyses.Add(analysis);
        Db.SaveChanges();
        return analysis;
    }

    public static IFormFile MakeFile(string name, byte[] bytes)
    {
        var stream = new MemoryStream(bytes);
        return new FormFile(stream, 0, bytes.Length, "file", name);
    }

    public static T WithUser<T>(T controller, int? userId) where T : ControllerBase
    {
        var claims = new List<Claim>();
        if (userId.HasValue)
        {
            claims.Add(new Claim(
                ClaimTypes.NameIdentifier,
                userId.Value.ToString()
            ));
        }
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(claims, "Test"))
            }
        };
        return controller;
    }

    public void Dispose()
    {
        Db.Dispose();
        _connection.Dispose();
        if (Directory.Exists(TempPath))
            Directory.Delete(TempPath, true);
    }
}

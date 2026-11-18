using CentralServer.Models;
using CentralServer.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using System.Reflection;
using System.Text.Json;
using Xunit;

namespace CentralServer.Tests;

public class RabbitMqResultWorkerTests
{
    private static async Task ProcessResult(TestSupport t, object message)
    {
        using var provider = new ServiceCollection()
            .AddSingleton(t.Db)
            .AddSingleton(t.CreateAnalysisService())
            .BuildServiceProvider();
        var worker = new RabbitMqResultWorker(
            provider.GetRequiredService<IServiceScopeFactory>(),
            t.Config,
            NullLogger<RabbitMqResultWorker>.Instance
        );
        var method = typeof(RabbitMqResultWorker).GetMethod(
            "SaveResultAsync",
            BindingFlags.Instance | BindingFlags.NonPublic
        );
        Assert.NotNull(method);
        byte[] json = JsonSerializer.SerializeToUtf8Bytes(message);
        var task = (Task)method!.Invoke(worker, new object[] { json })!;
        await task;
    }

    [Fact]
    public async Task FailedResult_ReturnsAttempt()
    {
        using var t = new TestSupport();
        var user = t.AddUser(freeUsed: 2);
        var analysis = t.AddAnalysis(user, "Pending", "Free");
        await ProcessResult(t, new
        {
            job_id = analysis.Id.ToString(),
            status = "failed",
            error = "no_bird_detected"
        });
        var updated = await t.Db.BirdAnalyses
            .AsNoTracking()
            .SingleAsync(a => a.Id == analysis.Id);
        var savedUser = await t.Db.Users
            .AsNoTracking()
            .SingleAsync(u => u.Id == user.Id);
        Assert.Equal("Failed", updated.Status);
        Assert.Equal(1, savedUser.FreeAttemptsUsed);
    }

    [Fact]
    public async Task CompletedResult_SavesThreePredictions()
    {
        using var t = new TestSupport();
        var user = t.AddUser(freeUsed: 1);
        var analysis = t.AddAnalysis(user);
        t.Db.BirdInfo.Add(new BirdInfo
        {
            EnglishName = "COCKATOO",
            Description = "Bird description"
        });
        await t.Db.SaveChangesAsync();
        await ProcessResult(t, new
        {
            job_id = analysis.Id.ToString(),
            status = "completed",
            analysis_date = DateTimeOffset.UtcNow,
            top_3 = new[]
            {
                new { species = "COCKATOO", confidence = 0.8 },
                new { species = "MACAW", confidence = 0.15 },
                new { species = "TOUCAN", confidence = 0.05 }
            }
        });
        var saved = await t.Db.BirdAnalyses
            .AsNoTracking()
            .Include(a => a.Predictions)
            .SingleAsync(a => a.Id == analysis.Id);
        Assert.Equal("Completed", saved.Status);
        Assert.Equal(3, saved.Predictions.Count);
        Assert.NotNull(saved.BirdInfoId);
    }

    [Fact]
    public async Task InvalidJobId_IsRejected()
    {
        using var t = new TestSupport();
        await Assert.ThrowsAsync<JsonException>(
            () => ProcessResult(t, new
            {
                job_id = "invalid",
                status = "completed"
            })
        );
    }

    [Fact]
    public async Task UnknownStatus_IsRejected()
    {
        using var t = new TestSupport();
        await Assert.ThrowsAsync<JsonException>(
            () => ProcessResult(t, new
            {
                job_id = "1",
                status = "unknown"
            })
        );
    }
}


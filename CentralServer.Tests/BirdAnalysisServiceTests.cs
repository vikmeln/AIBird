using Microsoft.EntityFrameworkCore;
using Xunit;

namespace CentralServer.Tests;

public class BirdAnalysisServiceTests
{
    [Fact]
    public async Task EmptyPhoto_IsRejected()
    {
        using var t = new TestSupport();
        var file = TestSupport.MakeFile("bird.jpg", Array.Empty<byte>());
        await Assert.ThrowsAsync<ArgumentException>(() => t.CreateAnalysisService().CreateAsync(1, file));
    }

    [Theory]
    [InlineData("bird.gif")]
    [InlineData("bird.bmp")]
    [InlineData("bird.webp")]
    [InlineData("bird.txt")]
    public async Task InvalidExtension_IsRejected(string filename)
    {
        using var t = new TestSupport();
        var file = TestSupport.MakeFile(filename, new byte[] { 0xFF, 0xD8, 0xFF });
        await Assert.ThrowsAsync<ArgumentException>(() => t.CreateAnalysisService().CreateAsync(1, file));
    }

    [Fact]
    public async Task LargePhoto_IsRejected()
    {
        using var t = new TestSupport();
        var file = TestSupport.MakeFile("bird.jpg", new byte[10 * 1024 * 1024 + 1]);
        await Assert.ThrowsAsync<ArgumentException>(() => t.CreateAnalysisService().CreateAsync(1, file));
    }

    [Fact]
    public async Task FakeJpeg_IsRejected()
    {
        using var t = new TestSupport();
        var file = TestSupport.MakeFile("bird.jpg", new byte[] { 1, 2, 3, 4 });
        await Assert.ThrowsAsync<ArgumentException>(() => t.CreateAnalysisService().CreateAsync(1, file));
    }

    [Fact]
    public async Task NoAttempts_AnalysisIsNotCreated()
    {
        using var t = new TestSupport();
        var user = t.AddUser(freeUsed: 5, paidLeft: 0);
        var file = TestSupport.MakeFile("bird.jpg", new byte[] { 0xFF, 0xD8, 0xFF });
        var result = await t.CreateAnalysisService().CreateAsync(user.Id, file);
        Assert.Null(result);
        Assert.Empty(await t.Db.BirdAnalyses.ToListAsync());
    }

    [Fact]
    public async Task FailedAnalysis_ReturnsFreeAttempt()
    {
        using var t = new TestSupport();
        var user = t.AddUser(freeUsed: 2);
        var analysis = t.AddAnalysis(user, "Pending", "Free");
        await t.CreateAnalysisService().MarkFailedAsync(analysis.Id);
        var savedUser = await t.Db.Users
            .AsNoTracking()
            .SingleAsync(u => u.Id == user.Id);
        var savedAnalysis = await t.Db.BirdAnalyses
            .AsNoTracking()
            .SingleAsync(a => a.Id == analysis.Id);
        Assert.Equal(1, savedUser.FreeAttemptsUsed);
        Assert.Equal("Failed", savedAnalysis.Status);
    }

    [Fact]
    public async Task FailedAnalysis_ReturnsPaidAttempt()
    {
        using var t = new TestSupport();
        var user = t.AddUser(freeUsed: 5, paidLeft: 3);
        var analysis = t.AddAnalysis(user, "Pending", "Paid");
        await t.CreateAnalysisService().MarkFailedAsync(analysis.Id);
        var savedUser = await t.Db.Users
            .AsNoTracking()
            .SingleAsync(u => u.Id == user.Id);
        Assert.Equal(4, savedUser.PaidAttemptsLeft);
    }

    [Fact]
    public async Task FailedAnalysis_DoesNotReturnAttemptTwice()
    {
        using var t = new TestSupport();
        var user = t.AddUser(freeUsed: 2);
        var analysis = t.AddAnalysis(user);
        var service = t.CreateAnalysisService();
        await service.MarkFailedAsync(analysis.Id);
        await service.MarkFailedAsync(analysis.Id);
        var savedUser = await t.Db.Users
            .AsNoTracking()
            .SingleAsync(u => u.Id == user.Id);
        Assert.Equal(1, savedUser.FreeAttemptsUsed);
    }

    [Fact]
    public async Task CompletedAnalysis_DoesNotReturnAttempt()
    {
        using var t = new TestSupport();
        var user = t.AddUser(freeUsed: 2);
        var analysis = t.AddAnalysis(user, "Completed");
        await t.CreateAnalysisService().MarkFailedAsync(analysis.Id);
        var savedUser = await t.Db.Users
            .AsNoTracking()
            .SingleAsync(u => u.Id == user.Id);
        Assert.Equal(2, savedUser.FreeAttemptsUsed);
    }

    [Theory]
    [InlineData("../secret.jpg")]
    [InlineData("folder/bird.jpg")]
    [InlineData(@"folder\bird.jpg")]
    [InlineData("")]
    public void InvalidImagePath_IsRejected(string filename)
    {
        using var t = new TestSupport();
        Assert.Throws<ArgumentException>(() => t.CreateAnalysisService().GetImagePath(filename));
    }
}

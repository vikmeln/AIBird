using CentralServer.Controllers;
using CentralServer.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace CentralServer.Tests;

public class BirdsControllerTests
{
    private static BirdsController CreateController(TestSupport t, int? userId)
    {
        return TestSupport.WithUser(new BirdsController(t.Db, t.CreateAnalysisService()), userId);
    }

    [Fact]
    public async Task WithoutLogin_ReturnsUnauthorized()
    {
        using var t = new TestSupport();
        var result = await CreateController(t, null).GetAll();
        Assert.IsType<UnauthorizedResult>(result);
    }

    [Fact]
    public async Task History_ReturnsOnlyOwnAnalyses()
    {
        using var t = new TestSupport();
        var firstUser = t.AddUser();
        var secondUser = t.AddUser();
        t.AddAnalysis(firstUser, "Completed");
        t.AddAnalysis(secondUser, "Completed");
        var response = await CreateController(t, firstUser.Id).GetAll();
        var ok = Assert.IsType<OkObjectResult>(response);
        var items = Assert.IsAssignableFrom<IEnumerable<BirdAnalysis>>(ok.Value);
        Assert.Single(items);
        Assert.All(items, a => Assert.Equal(firstUser.Id, a.UserId));
    }

    [Fact]
    public async Task User_CannotReadAnotherUsersAnalysis()
    {
        using var t = new TestSupport();
        var owner = t.AddUser();
        var other = t.AddUser();
        var analysis = t.AddAnalysis(owner);
        var result = await CreateController(t, other.Id).GetById(analysis.Id);
        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public async Task Owner_CanReadOwnAnalysis()
    {
        using var t = new TestSupport();
        var user = t.AddUser();
        var analysis = t.AddAnalysis(user);
        var result = await CreateController(t, user.Id).GetById(analysis.Id);
        var ok = Assert.IsType<OkObjectResult>(result);
        var saved = Assert.IsType<BirdAnalysis>(ok.Value);
        Assert.Equal(analysis.Id, saved.Id);
    }

    [Fact]
    public async Task EmptySearch_ReturnsBadRequest()
    {
        using var t = new TestSupport();
        var user = t.AddUser();
        var result = await CreateController(t, user.Id).Search(" ");
        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Theory]
    [InlineData(0, 5)]
    [InlineData(2, 3)]
    [InlineData(5, 0)]
    public async Task Attempts_ReturnCorrectFreeBalance(int used, int expected)
    {
        using var t = new TestSupport();
        var user = t.AddUser(freeUsed: used, paidLeft: 10);
        var result = await CreateController(t, user.Id).GetAttempts();
        var ok = Assert.IsType<OkObjectResult>(result);
        var property = ok.Value!.GetType().GetProperty("freeAttemptsLeft");
        Assert.Equal(expected, property!.GetValue(ok.Value));
    }

    [Fact]
    public async Task NoAttempts_ReturnsPaymentRequired()
    {
        using var t = new TestSupport();
        var user = t.AddUser(freeUsed: 5, paidLeft: 0);
        var file = TestSupport.MakeFile("bird.jpg", new byte[] { 0xFF, 0xD8, 0xFF });
        var result = await CreateController(t, user.Id).Analyze(file);
        var response = Assert.IsType<ObjectResult>(result);
        Assert.Equal(402, response.StatusCode);
    }

    [Fact]
    public async Task InvalidUpload_ReturnsBadRequest()
    {
        using var t = new TestSupport();
        var user = t.AddUser();
        var file = TestSupport.MakeFile("bird.txt", new byte[] { 1, 2, 3 });
        var result = await CreateController(t, user.Id).Analyze(file);
        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task PendingAnalysis_CannotBeDeleted()
    {
        using var t = new TestSupport();
        var user = t.AddUser();
        var analysis = t.AddAnalysis(user, "Pending");
        var result = await CreateController(t, user.Id).Delete(analysis.Id);
        Assert.IsType<ConflictObjectResult>(result);
        Assert.True(await t.Db.BirdAnalyses.AnyAsync(a => a.Id == analysis.Id));
    }

    [Fact]
    public async Task AnotherUsersAnalysis_CannotBeDeleted()
    {
        using var t = new TestSupport();
        var owner = t.AddUser();
        var other = t.AddUser();
        var analysis = t.AddAnalysis(owner, "Completed");
        var result = await CreateController(t, other.Id).Delete(analysis.Id);
        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public async Task CompletedAnalysis_CanBeDeleted()
    {
        using var t = new TestSupport();
        var user = t.AddUser();
        var analysis = t.AddAnalysis(user, "Completed");
        var result = await CreateController(t, user.Id).Delete(analysis.Id);
        Assert.IsType<NoContentResult>(result);
        Assert.False(await t.Db.BirdAnalyses.AnyAsync(a => a.Id == analysis.Id));
    }
}

using CentralServer.Controllers;
using CentralServer.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace CentralServer.Tests;

public class AdminControllerTests
{
    [Fact]
    public void AdminController_RequiresAdminRole()
    {
        var attribute = Attribute.GetCustomAttribute(
            typeof(AdminController),
            typeof(AuthorizeAttribute)
        ) as AuthorizeAttribute;
        Assert.NotNull(attribute);
        Assert.Equal("Admin", attribute.Roles);
    }

    [Fact]
    public async Task GetUsers_ReturnsOk()
    {
        using var t = new TestSupport();
        t.AddUser();
        t.AddUser();
        var controller = new AdminController(t.Db);
        var result = await controller.GetUsers();
        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.NotNull(ok.Value);
    }

    [Fact]
    public async Task GetAnalyses_ReturnsOk()
    {
        using var t = new TestSupport();
        var user = t.AddUser();
        t.AddAnalysis(user, "Completed");
        var controller = new AdminController(t.Db);
        var result = await controller.GetAnalyses();
        Assert.IsType<OkObjectResult>(result);
    }

    [Fact]
    public async Task GetPayments_ReturnsOk()
    {
        using var t = new TestSupport();
        var controller = new AdminController(t.Db);
        var result = await controller.GetPayments();
        Assert.IsType<OkObjectResult>(result);
    }
}

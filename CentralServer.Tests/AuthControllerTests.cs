using CentralServer.Controllers;
using CentralServer.DTOs;
using CentralServer.Models;
using CentralServer.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Xunit;

namespace CentralServer.Tests;

public class AuthControllerTests
{
    private static Mock<UserManager<User>> CreateManager()
    {
        var store = new Mock<IUserStore<User>>();
        return new Mock<UserManager<User>>(
            store.Object,
            null!, null!, null!, null!,
            null!, null!, null!, null!
        );
    }

    [Fact]
    public async Task Register_CreatesUser()
    {
        using var t = new TestSupport();
        var manager = CreateManager();
        manager
            .Setup(m => m.CreateAsync(It.IsAny<User>(), It.IsAny<string>()))
            .ReturnsAsync(IdentityResult.Success);
        manager
            .Setup(m => m.AddToRoleAsync(It.IsAny<User>(), "User"))
            .ReturnsAsync(IdentityResult.Success);
        var controller = new AuthController(
            manager.Object,
            new TokenService(t.Config)
        );
        var result = await controller.Register(new RegisterDto
        {
            Email = "test@example.com",
            Password = "Password123!"
        });
        Assert.IsType<OkObjectResult>(result);
        manager.Verify(m => m.AddToRoleAsync(It.IsAny<User>(), "User"), Times.Once);
    }

    [Fact]
    public async Task Register_InvalidUser_ReturnsBadRequest()
    {
        using var t = new TestSupport();
        var manager = CreateManager();
        manager
            .Setup(m => m.CreateAsync(It.IsAny<User>(), It.IsAny<string>()))
            .ReturnsAsync(IdentityResult.Failed(
                new IdentityError
                {
                    Description = "Registration failed"
                }
            ));
        var controller = new AuthController(
            manager.Object,
            new TokenService(t.Config)
        );
        var result = await controller.Register(new RegisterDto
        {
            Email = "test@example.com",
            Password = "123"
        });
        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task Login_UnknownUser_ReturnsUnauthorized()
    {
        using var t = new TestSupport();
        var manager = CreateManager();
        manager
            .Setup(m => m.FindByEmailAsync(It.IsAny<string>()))
            .ReturnsAsync((User?)null);
        var controller = new AuthController(
            manager.Object,
            new TokenService(t.Config)
        );
        var result = await controller.Login(new LoginDto
        {
            Email = "unknown@example.com",
            Password = "Password123!"
        });
        Assert.IsType<UnauthorizedObjectResult>(result);
    }

    [Fact]
    public async Task Login_WrongPassword_ReturnsUnauthorized()
    {
        using var t = new TestSupport();
        var user = new User
        {
            Id = 1,
            Email = "test@example.com"
        };
        var manager = CreateManager();
        manager
            .Setup(m => m.FindByEmailAsync(user.Email!))
            .ReturnsAsync(user);
        manager
            .Setup(m => m.IsLockedOutAsync(user))
            .ReturnsAsync(false);
        manager
            .Setup(m => m.CheckPasswordAsync(user, "wrong"))
            .ReturnsAsync(false);
        var controller = new AuthController(
            manager.Object,
            new TokenService(t.Config)
        );
        var result = await controller.Login(new LoginDto
        {
            Email = user.Email!,
            Password = "wrong"
        });
        Assert.IsType<UnauthorizedObjectResult>(result);
        manager.Verify(m => m.AccessFailedAsync(user), Times.Once);
    }

    [Fact]
    public async Task Login_ValidPassword_ReturnsToken()
    {
        using var t = new TestSupport();
        var user = new User
        {
            Id = 1,
            Email = "test@example.com"
        };
        var manager = CreateManager();
        manager
            .Setup(m => m.FindByEmailAsync(user.Email!))
            .ReturnsAsync(user);
        manager
            .Setup(m => m.IsLockedOutAsync(user))
            .ReturnsAsync(false);
        manager
            .Setup(m => m.CheckPasswordAsync(user, "Password123!"))
            .ReturnsAsync(true);
        manager
            .Setup(m => m.GetRolesAsync(user))
            .ReturnsAsync(new List<string> { "User" });
        var controller = new AuthController(manager.Object, new TokenService(t.Config));
        var result = await controller.Login(new LoginDto
        {
            Email = user.Email!,
            Password = "Password123!"
        });
        Assert.IsType<OkObjectResult>(result);
        manager.Verify(m => m.ResetAccessFailedCountAsync(user), Times.Once);
    }
}

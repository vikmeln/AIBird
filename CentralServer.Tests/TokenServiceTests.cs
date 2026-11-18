using CentralServer.Models;
using CentralServer.Services;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Xunit;

namespace CentralServer.Tests;

public class TokenServiceTests
{
    [Fact]
    public void Token_HasCorrectIssuerAndAudience()
    {
        using var t = new TestSupport();
        var user = new User
        {
            Id = 10,
            Email = "test@example.com"
        };
        string token = new TokenService(t.Config).CreateToken(user, new List<string> { "User" });
        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(token);
        Assert.Equal("AIBirdLab.Tests", jwt.Issuer);
        Assert.Contains("AIBirdLab.Client", jwt.Audiences);
        Assert.True(jwt.ValidTo > DateTime.UtcNow);
    }

    [Fact]
    public void Token_ContainsUserIdAndRole()
    {
        using var t = new TestSupport();
        var user = new User
        {
            Id = 7,
            Email = "admin@example.com"
        };
        string token = new TokenService(t.Config).CreateToken(user, new List<string> { "Admin" });
        var handler = new JwtSecurityTokenHandler();
        var parameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = t.Config["Jwt:Issuer"],
            ValidAudience = t.Config["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(t.Config["Jwt:Key"]!))
        };
        var principal = handler.ValidateToken(token, parameters, out _);
        Assert.Equal("7", principal.FindFirstValue(ClaimTypes.NameIdentifier));
        Assert.True(principal.IsInRole("Admin"));
    }
}

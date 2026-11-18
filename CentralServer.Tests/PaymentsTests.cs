using CentralServer.Controllers;
using CentralServer.Models;
using CentralServer.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using System.ComponentModel.DataAnnotations;
using Xunit;

namespace CentralServer.Tests;

public class PaymentsTests
{
    private static bool IsValidHash(string hash)
    {
        var request = new PaymentRequest
        {
            TransactionHash = hash
        };
        var context = new ValidationContext(request);
        return Validator.TryValidateObject(
            request,
            context,
            new List<ValidationResult>(),
            true
        );
    }

    [Theory]
    [InlineData("")]
    [InlineData("123")]
    [InlineData("0x1234")]
    public void InvalidTransactionHash_IsRejected(string hash)
    {
        Assert.False(IsValidHash(hash));
    }

    [Fact]
    public void ValidTransactionHash_IsAccepted()
    {
        string hash = "0x" + new string('a', 64);
        Assert.True(IsValidHash(hash));
    }

    [Fact]
    public void PaymentInfo_ReturnsCorrectPackage()
    {
        using var t = new TestSupport();
        var controller = TestSupport.WithUser(
            new PaymentsController(
                new PaymentService(t.Db, t.Config),
                t.Config,
                NullLogger<PaymentsController>.Instance
            ),
            12
        );

        var result = controller.GetInfo();
        var ok = Assert.IsType<OkObjectResult>(result);
        var price = ok.Value!.GetType()
            .GetProperty("priceEth")!
            .GetValue(ok.Value);
        var attempts = ok.Value.GetType()
            .GetProperty("attempts")!
            .GetValue(ok.Value);
        Assert.Equal("0.001", price);
        Assert.Equal(20, attempts);
    }

    [Fact]
    public async Task DuplicatePayment_IsRejectedByDatabase()
    {
        using var t = new TestSupport();
        var user = t.AddUser();
        string hash = "0x" + new string('a', 64);
        t.Db.Payments.Add(new Payment
        {
            UserId = user.Id,
            ChainId = 31337,
            TransactionHash = hash,
            WalletAddress = "0x" + new string('1', 40),
            AttemptsAdded = 20,
            PaidAt = DateTime.UtcNow
        });
        await t.Db.SaveChangesAsync();
        t.Db.Payments.Add(new Payment
        {
            UserId = user.Id,
            ChainId = 31337,
            TransactionHash = hash,
            WalletAddress = "0x" + new string('2', 40),
            AttemptsAdded = 20,
            PaidAt = DateTime.UtcNow
        });
        await Assert.ThrowsAsync<DbUpdateException>(() => t.Db.SaveChangesAsync());
    }
}

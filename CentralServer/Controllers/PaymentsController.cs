using CentralServer.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.ComponentModel.DataAnnotations;
using System.Security.Claims;

namespace CentralServer.Controllers;

[ApiController]
[Route("api/payments")]
[Authorize]
public class PaymentsController : ControllerBase
{
    private readonly PaymentService _paymentService;
    private readonly IConfiguration _config;
    private readonly ILogger<PaymentsController> _logger;

    public PaymentsController(PaymentService paymentService, IConfiguration config, ILogger<PaymentsController> logger)
    {
        _paymentService = paymentService;
        _config = config;
        _logger = logger;
    }

    // Информация для покупки через MetaMask
    [HttpGet("info")]
    public IActionResult GetInfo()
    {
        int userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        return Ok(new
        {
            userId,
            contractAddress = _config["Blockchain:ContractAddress"],
            chainId = _config.GetValue<int>("Blockchain:ChainId"),
            priceEth = "0.001",
            attempts = 20
        });
    }

    // Подтверждение оплаты
    [HttpPost("confirm")]
    public async Task<IActionResult> Confirm(PaymentRequest request)
    {
        int userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        try
        {
            bool success = await _paymentService.ConfirmPaymentAsync(userId, request.TransactionHash);
            if (!success)
                return BadRequest("Платёж не подтверждён или уже использован");
            return Ok(new
            {
                message = "Оплата подтверждена",
                attemptsAdded = 20
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Payment verification failed");
            return StatusCode(503, "Не удалось проверить транзакцию");
        }
    }
}

// Данные запроса от React
public class PaymentRequest
{
    [Required]
    [RegularExpression(@"^0x[0-9a-fA-F]{64}$")]
    public string TransactionHash { get; set; } = string.Empty;
}

using Microsoft.AspNetCore.Identity;

namespace CentralServer.Models;

public class User : IdentityUser<int>
{
    // Количество использованных бесплатных попыток
    public int FreeAttemptsUsed { get; set; } = 0;
    // Остаток оплаченных попыток
    public int PaidAttemptsLeft { get; set; } = 0;
}

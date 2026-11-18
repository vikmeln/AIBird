namespace CentralServer.Models;

public class Payment
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string WalletAddress { get; set; } = string.Empty;
    public string TransactionHash { get; set; } = string.Empty;
    public int ChainId { get; set; }
    public int AttemptsAdded { get; set; }
    public DateTime PaidAt { get; set; }
}

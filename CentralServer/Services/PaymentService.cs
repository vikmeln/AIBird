using CentralServer.Data;
using CentralServer.Models;
using Microsoft.EntityFrameworkCore;
using Nethereum.ABI.FunctionEncoding.Attributes;
using Nethereum.Contracts;
using Nethereum.Web3;
using System.Data;
using System.Numerics;

namespace CentralServer.Services;

public class PaymentService
{
    private readonly BirdLabDbContext _db;
    private readonly Web3 _web3;
    private readonly string _contractAddress;
    private readonly int _chainId;

    // Цена 0.001 ETH
    private static readonly BigInteger Price = new BigInteger(1_000_000_000_000_000);
    private const int PackageAttempts = 20;

    public PaymentService(BirdLabDbContext db, IConfiguration config)
    {
        _db = db;
        string rpcUrl = config["Blockchain:RpcUrl"] ?? throw new Exception("RPC URL is missing");
        _contractAddress = config["Blockchain:ContractAddress"] ?? throw new Exception("Contract address is missing");
        _chainId = config.GetValue<int>("Blockchain:ChainId");
        _web3 = new Web3(rpcUrl);
    }

    // Проверяем платёж и начисляем попытки
    public async Task<bool> ConfirmPaymentAsync(int userId, string transactionHash)
    {
        transactionHash = transactionHash.ToLowerInvariant();
        // Проверяем сеть
        var chain = await _web3.Eth.ChainId.SendRequestAsync();
        if (chain.Value != _chainId)
            return false;
        // Получаем транзакцию из блокчейна
        var transaction = await _web3.Eth.Transactions.GetTransactionByHash.SendRequestAsync(transactionHash);
        var receipt = await _web3.Eth.Transactions.GetTransactionReceipt.SendRequestAsync(transactionHash);
        // Транзакция должна быть успешной
        if (transaction == null || receipt == null || receipt.Status == null || receipt.Status.Value != 1)
            return false;
        // Проверяем адрес контракта
        if (!string.Equals(transaction.To, _contractAddress, StringComparison.OrdinalIgnoreCase))
            return false;
        // Проверяем сумму оплаты
        if (transaction.Value == null || transaction.Value.Value != Price)
            return false;
        // Проверяем событие покупки
        var purchase = receipt
            .DecodeAllEvents<PackagePurchasedEventDTO>()
            .FirstOrDefault(e =>
                string.Equals(
                    e.Log.Address,
                    _contractAddress,
                    StringComparison.OrdinalIgnoreCase) &&
                e.Event.UserId == userId &&
                e.Event.Attempts == PackageAttempts &&
                e.Event.Amount == Price &&
                string.Equals(
                    e.Event.Buyer,
                    transaction.From,
                    StringComparison.OrdinalIgnoreCase));
        if (purchase == null)
            return false;
        // Сохраняем платёж и попытки одной транзакцией БД
        await using var dbTransaction = await _db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        // Повторно один платёж не засчитываем
        bool exists = await _db.Set<Payment>().AnyAsync(p => p.ChainId == _chainId && p.TransactionHash == transactionHash);
        if (exists)
            return false;
        // Начисляем 20 попыток
        int updated = await _db.Users
            .Where(u => u.Id == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(
                u => u.PaidAttemptsLeft,
                u => u.PaidAttemptsLeft + PackageAttempts));
        if (updated == 0)
            return false;
        // Сохраняем информацию о покупке
        var payment = new Payment
        {
            UserId = userId,
            WalletAddress = transaction.From,
            TransactionHash = transactionHash,
            ChainId = _chainId,
            AttemptsAdded = PackageAttempts,
            PaidAt = DateTime.UtcNow
        };
        _db.Set<Payment>().Add(payment);
        await _db.SaveChangesAsync();
        await dbTransaction.CommitAsync();
        return true;
    }
}


// Событие из смарт-контракта Solidity
[Event("PackagePurchased")]
public class PackagePurchasedEventDTO : IEventDTO
{
    [Parameter("address", "buyer", 1, true)]
    public string Buyer { get; set; } = string.Empty;
    [Parameter("uint256", "userId", 2, true)]
    public BigInteger UserId { get; set; }
    [Parameter("uint256", "attempts", 3, false)]
    public BigInteger Attempts { get; set; }
    [Parameter("uint256", "amount", 4, false)]
    public BigInteger Amount { get; set; }
}

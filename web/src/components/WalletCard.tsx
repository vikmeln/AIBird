import { useEffect, useState } from "react";
import { BrowserProvider, Contract, parseEther } from "ethers";
import { paymentsApi } from "../api";
import type { PaymentInfo } from "../types";

interface Props {
  token: string;
  onPaid: () => void;
}

const ABI = [
  "function PACKAGE_PRICE() view returns (uint256)",
  "function buyPackage(uint256 userId) payable",
];

type EthereumProvider = ConstructorParameters<typeof BrowserProvider>[0];

function getEthereum() {
  const ethereum = (window as Window & { ethereum?: EthereumProvider })
    .ethereum;
  if (!ethereum) {
    throw new Error("MetaMask не найден в браузере");
  }
  return ethereum;
}

function paymentKey(info: PaymentInfo) {
  return `birdlab-payment-${info.chainId}-${info.userId}`;
}

export default function WalletCard({ token, onPaid }: Props) {
  const [info, setInfo] = useState<PaymentInfo | null>(null);
  const [wallet, setWallet] = useState("");
  const [pendingHash, setPendingHash] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    paymentsApi
      .info(token)
      .then((data) => {
        if (!active) return;

        setInfo(data);
        setPendingHash(sessionStorage.getItem(paymentKey(data)) ?? "");
      })
      .catch((err: unknown) => {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Не удалось получить информацию об оплате",
          );
        }
      });

    return () => {
      active = false;
    };
  }, [token]);

  async function connectProvider(chainId: number) {
    const ethereum = getEthereum();
    let provider = new BrowserProvider(ethereum);
    await provider.send("eth_requestAccounts", []);
    const network = await provider.getNetwork();
    if (network.chainId !== BigInt(chainId)) {
      try {
        await provider.send("wallet_switchEthereumChain", [
          { chainId: `0x${chainId.toString(16)}` },
        ]);
      } catch {
        throw new Error("Добавь сеть Anvil Local в MetaMask");
      }
      provider = new BrowserProvider(ethereum);
    }
    const currentNetwork = await provider.getNetwork();
    if (currentNetwork.chainId !== BigInt(chainId)) {
      throw new Error("Выбрана неправильная сеть");
    }
    return provider;
  }

  async function connectWallet() {
    if (!info) return;
    setLoading(true);
    setError("");
    setMessage("");
    try {
      if (!info.contractAddress) {
        throw new Error("Адрес контракта не настроен в Central Server");
      }
      const provider = await connectProvider(info.chainId);
      const code = await provider.getCode(info.contractAddress);
      if (code === "0x") {
        throw new Error("Контракт не найден в сети Anvil");
      }
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const contract = new Contract(info.contractAddress, ABI, signer);
      const price: bigint = await contract.PACKAGE_PRICE();
      if (price !== parseEther(info.priceEth)) {
        throw new Error("Цена в контракте не совпадает с сервером");
      }
      setWallet(address);
      setMessage("MetaMask подключён");
    } catch (err) {
      setWallet("");
      setError(err instanceof Error ? err.message : "Ошибка подключения");
    } finally {
      setLoading(false);
    }
  }

  async function confirmPayment(hash: string, data: PaymentInfo) {
    const result = await paymentsApi.confirm(hash, token);
    sessionStorage.removeItem(paymentKey(data));
    setPendingHash("");
    setMessage(
      `Оплата подтверждена. Начислено ${result.attemptsAdded} попыток.`,
    );
    onPaid();
  }

  async function buyPackage() {
    if (!info || !wallet || pendingHash) return;
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const provider = await connectProvider(info.chainId);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      if (address.toLowerCase() !== wallet.toLowerCase()) {
        throw new Error("Аккаунт MetaMask изменился. Подключись заново.");
      }
      const contract = new Contract(info.contractAddress, ABI, signer);
      const price: bigint = await contract.PACKAGE_PRICE();
      if (price !== parseEther(info.priceEth)) {
        throw new Error("Цена в контракте не совпадает с сервером");
      }
      setMessage("Подтверди транзакцию в MetaMask");
      const tx = await contract.buyPackage(BigInt(info.userId), {
        value: price,
      });
      sessionStorage.setItem(paymentKey(info), tx.hash);
      setPendingHash(tx.hash);
      setMessage("Транзакция отправлена. Ожидаем подтверждения...");
      const receipt = await tx.wait();
      if (receipt?.status !== 1) {
        throw new Error("Транзакция не подтверждена. Проверь её статус.");
      }
      await confirmPayment(tx.hash, info);
    } catch (err) {
      setMessage("");
      setError(err instanceof Error ? err.message : "Ошибка оплаты");
    } finally {
      setLoading(false);
    }
  }

  async function retryConfirmation() {
    if (!info || !pendingHash) return;
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const provider = await connectProvider(info.chainId);
      const receipt = await provider.getTransactionReceipt(pendingHash);
      if (!receipt) {
        throw new Error("Транзакция ещё не подтверждена");
      }
      if (receipt.status !== 1) {
        throw new Error("Транзакция завершилась с ошибкой");
      }
      await confirmPayment(pendingHash, info);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Не удалось проверить платёж",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="wallet-card">
      <div>
        <span className="eyebrow">METAMASK</span>
        <h2>Дополнительные попытки</h2>

        <p className="muted">
          Покупка распознаваний через тестовую сеть Anvil.
        </p>

        <p>
          <strong>
            {info
              ? `${info.attempts} попыток — ${info.priceEth} ETH`
              : "Загрузка тарифа..."}
          </strong>
        </p>

        {wallet && (
          <p className="muted">
            Кошелёк: {wallet.slice(0, 6)}...
            {wallet.slice(-4)}
          </p>
        )}

        {message && <p className="success">{message}</p>}
        {error && <p className="error">{error}</p>}
      </div>

      <div className="wallet-actions">
        <button
          className="outline-button"
          disabled={!info || loading}
          onClick={() => void connectWallet()}
        >
          {wallet
            ? `${wallet.slice(0, 6)}...${wallet.slice(-4)}`
            : "Подключить MetaMask"}
        </button>

        <button
          className="primary-button"
          disabled={!wallet || !info || loading || !!pendingHash}
          onClick={() => void buyPackage()}
        >
          {loading ? "Обработка..." : "Купить попытки"}
        </button>

        {pendingHash && (
          <button
            className="outline-button"
            disabled={loading}
            onClick={() => void retryConfirmation()}
          >
            Проверить платёж
          </button>
        )}
      </div>
    </section>
  );
}

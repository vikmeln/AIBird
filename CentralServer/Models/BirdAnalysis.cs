namespace CentralServer.Models;

public class BirdAnalysis
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string SavedFileName { get; set; } = string.Empty;
    // Состояние и тип попытки
    public string Status { get; set; } = "Pending";
    public string AttemptType { get; set; } = "Free";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? AnalysisDate { get; set; }
    // Информация о птице
    public int? BirdInfoId { get; set; }
    public BirdInfo? BirdInfo { get; set; }
    // Результаты распознавания
    public List<BirdPrediction> Predictions { get; set; } = new();
}

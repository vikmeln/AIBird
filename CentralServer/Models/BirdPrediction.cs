namespace CentralServer.Models;

public class BirdPrediction
{
    public int Id { get; set; }
    public int AnalysisId { get; set; }
    public string BirdName { get; set; } = string.Empty;
    // Уверенность модели
    public double Confidence { get; set; }
    // Место результата: 1, 2 или 3
    public int Rank { get; set; }
}

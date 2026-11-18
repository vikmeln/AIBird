namespace CentralServer.Models;

public class BirdInfo
{
    public int Id { get; set; }
    public string EnglishName { get; set; } = string.Empty;
    public string? UkrainianName { get; set; }
    public string? ScientificName { get; set; }
    public string? Family { get; set; }
    public string? Habitat { get; set; }
    public string? Distribution { get; set; }
    public string? Diet { get; set; }
    public string? AverageSize { get; set; }
    public string? Description { get; set; }
    public string? InterestingFacts { get; set; }
    public string? ConservationStatus { get; set; }
    public string? SourceUrl { get; set; }
}

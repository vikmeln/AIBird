using CentralServer.Models;
using Xunit;

namespace CentralServer.Tests;

public class BirdAnalysisTests
{
    [Fact]
    public void NewAnalysis_HasPendingStatus()
    {
        var analysis = new BirdAnalysis();
        Assert.Equal("Pending", analysis.Status);
    }

    [Fact]
    public void NewAnalysis_UsesFreeAttempt()
    {
        var analysis = new BirdAnalysis();
        Assert.Equal("Free", analysis.AttemptType);
    }

    [Fact]
    public void NewAnalysis_HasEmptyPredictions()
    {
        var analysis = new BirdAnalysis();
        Assert.Empty(analysis.Predictions);
    }

    [Fact]
    public void NewAnalysis_HasNoBirdInfo()
    {
        var analysis = new BirdAnalysis();
        Assert.Null(analysis.BirdInfoId);
        Assert.Null(analysis.BirdInfo);
    }

    [Fact]
    public void Analysis_CanStoreThreePredictions()
    {
        var analysis = new BirdAnalysis();
        analysis.Predictions.Add(new BirdPrediction
        {
            BirdName = "COCKATOO",
            Confidence = 0.8,
            Rank = 1
        });
        analysis.Predictions.Add(new BirdPrediction
        {
            BirdName = "MACAW",
            Confidence = 0.15,
            Rank = 2
        });
        analysis.Predictions.Add(new BirdPrediction
        {
            BirdName = "TOUCAN",
            Confidence = 0.05,
            Rank = 3
        });
        Assert.Equal(3, analysis.Predictions.Count);
        Assert.Equal("COCKATOO", analysis.Predictions[0].BirdName);
    }

    [Theory]
    [InlineData("Completed")]
    [InlineData("Failed")]
    public void Analysis_CanChangeStatus(string status)
    {
        var analysis = new BirdAnalysis
        {
            Status = status,
            AnalysisDate = DateTime.UtcNow
        };
        Assert.Equal(status, analysis.Status);
        Assert.NotNull(analysis.AnalysisDate);
    }
}

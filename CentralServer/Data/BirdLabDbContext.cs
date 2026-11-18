using CentralServer.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace CentralServer.Data;

public class BirdLabDbContext : IdentityDbContext<User, IdentityRole<int>, int>
{
    public BirdLabDbContext(DbContextOptions<BirdLabDbContext> options) : base(options) {}

    public DbSet<BirdAnalysis> BirdAnalyses { get; set; }
    public DbSet<BirdPrediction> BirdPredictions { get; set; }
    public DbSet<BirdInfo> BirdInfo { get; set; }
    public DbSet<Payment> Payments { get; set; }

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.Entity<User>().ToTable("User");
        builder.Entity<BirdAnalysis>()
            .HasOne<User>()
            .WithMany()
            .HasForeignKey(a => a.UserId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.Entity<BirdAnalysis>()
            .HasMany(a => a.Predictions)
            .WithOne()
            .HasForeignKey(p => p.AnalysisId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Entity<BirdAnalysis>()
            .HasOne(a => a.BirdInfo)
            .WithMany()
            .HasForeignKey(a => a.BirdInfoId)
            .OnDelete(DeleteBehavior.SetNull);
        builder.Entity<BirdPrediction>()
            .HasIndex(p => new { p.AnalysisId, p.Rank })
            .IsUnique();
        builder.Entity<Payment>()
            .HasOne<User>()
            .WithMany()
            .HasForeignKey(p => p.UserId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.Entity<Payment>()
            .HasIndex(p => new { p.ChainId, p.TransactionHash })
            .IsUnique();
        builder.Entity<BirdAnalysis>()
            .Property(a => a.FileName)
            .HasMaxLength(255);
        builder.Entity<BirdAnalysis>()
            .Property(a => a.SavedFileName)
            .HasMaxLength(255);
        builder.Entity<BirdPrediction>()
            .Property(p => p.BirdName)
            .HasMaxLength(200);
        builder.Entity<Payment>()
            .Property(p => p.TransactionHash)
            .HasMaxLength(66);
        builder.Entity<Payment>()
            .Property(p => p.WalletAddress)
            .HasMaxLength(42);
    }
}

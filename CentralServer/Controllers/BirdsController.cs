using CentralServer.Data;
using CentralServer.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace CentralServer.Controllers;

[ApiController]
[Route("api/birds")]
[Authorize]
public class BirdsController : ControllerBase
{
    private readonly BirdLabDbContext _db;
    private readonly BirdAnalysisService _analysisService;

    public BirdsController(BirdLabDbContext db, BirdAnalysisService analysisService)
    {
        _db = db;
        _analysisService = analysisService;
    }

    private int GetUserId()
    {
        return int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out int id) ? id : 0;
    }

    // Загрузить фотографию
    [HttpPost("analyze")]
    [RequestSizeLimit(12 * 1024 * 1024)]
    public async Task<IActionResult> Analyze(IFormFile file)
    {
        int userId = GetUserId();
        if (userId == 0)
            return Unauthorized();
        try
        {
            var analysis = await _analysisService.CreateAsync(userId, file);
            if (analysis == null)
            {
                return StatusCode(402, new
                {
                    message = "Бесплатные попытки закончились. Оплатите тариф."
                });
            }
            return Accepted(new
            {
                analysis.Id,
                analysis.Status
            });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            return StatusCode(503, ex.Message);
        }
    }

    // История анализов пользователя
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        int userId = GetUserId();
        if (userId == 0)
            return Unauthorized();
        var analyses = await _db.BirdAnalyses
            .AsNoTracking()
            .Include(a => a.Predictions)
            .Include(a => a.BirdInfo)
            .Where(a => a.UserId == userId)
            .OrderByDescending(a => a.CreatedAt)
            .ToListAsync();
        return Ok(analyses);
    }

    // Один анализ по ID
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        int userId = GetUserId();
        if (userId == 0)
            return Unauthorized();
        var analysis = await _db.BirdAnalyses
            .AsNoTracking()
            .Include(a => a.Predictions)
            .Include(a => a.BirdInfo)
            .FirstOrDefaultAsync(a => a.Id == id && a.UserId == userId);
        if (analysis == null)
            return NotFound();
        return Ok(analysis);
    }

    // Поиск птицы по названию
    [HttpGet("search")]
    public async Task<IActionResult> Search(string name)
    {
        int userId = GetUserId();
        if (userId == 0)
            return Unauthorized();
        if (string.IsNullOrWhiteSpace(name))
            return BadRequest("Введите название птицы");
        var analyses = await _db.BirdAnalyses
            .AsNoTracking()
            .Include(a => a.Predictions)
            .Where(a => a.UserId == userId &&
                a.Predictions.Any(p =>
                    p.Rank == 1 &&
                    p.BirdName.Contains(name)))
            .ToListAsync();
        return Ok(analyses);
    }

    // Количество оставшихся попыток
    [HttpGet("attempts")]
    public async Task<IActionResult> GetAttempts()
    {
        int userId = GetUserId();
        if (userId == 0)
            return Unauthorized();
        var user = await _db.Users.FindAsync(userId);
        if (user == null)
            return NotFound();
        return Ok(new
        {
            freeAttemptsLeft = Math.Max(
                0, 5 - user.FreeAttemptsUsed
            ),
            paidAttemptsLeft = user.PaidAttemptsLeft
        });
    }

    // Получить фотографию из истории
    [HttpGet("{id:int}/image")]
    public async Task<IActionResult> GetImage(int id)
    {
        int userId = GetUserId();
        if (userId == 0)
            return Unauthorized();
        var analysis = await _db.BirdAnalyses
            .AsNoTracking()
            .FirstOrDefaultAsync(a => a.Id == id && a.UserId == userId);
        if (analysis == null)
            return NotFound();
        string path = _analysisService.GetImagePath(
            analysis.SavedFileName
        );
        if (!System.IO.File.Exists(path))
            return NotFound();
        string contentType = Path.GetExtension(path).ToLowerInvariant() == ".png" ? "image/png" : "image/jpeg";
        return PhysicalFile(path, contentType);
    }

    // Удалить анализ из истории
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        int userId = GetUserId();
        if (userId == 0)
            return Unauthorized();
        var analysis = await _db.BirdAnalyses.FirstOrDefaultAsync(a => a.Id == id && a.UserId == userId);
        if (analysis == null)
            return NotFound();
        if (analysis.Status == "Pending")
            return Conflict("Дождитесь завершения анализа");
        string path = _analysisService.GetImagePath(analysis.SavedFileName);
        _db.BirdAnalyses.Remove(analysis);
        await _db.SaveChangesAsync();
        if (System.IO.File.Exists(path)) System.IO.File.Delete(path);
        return NoContent();
    }
}

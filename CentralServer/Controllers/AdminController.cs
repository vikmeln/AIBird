using CentralServer.Data;
using CentralServer.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CentralServer.Controllers;

[ApiController]
[Route("api/admin")]
[Authorize(Roles = "Admin")]
public class AdminController : ControllerBase
{
    private readonly BirdLabDbContext _db;

    public AdminController(BirdLabDbContext db)
    {
        _db = db;
    }

    [HttpGet("users")]
    public async Task<IActionResult> GetUsers()
    {
        var users = await _db.Users.AsNoTracking()
            .Select(u => new
            {
                u.Id,
                u.Email,
                u.FreeAttemptsUsed,
                u.PaidAttemptsLeft
            })
            .ToListAsync();
        return Ok(users);
    }

    [HttpGet("analyses")]
    public async Task<IActionResult> GetAnalyses()
    {
        var analyses = await _db.BirdAnalyses
            .AsNoTracking()
            .Include(a => a.Predictions)
            .OrderByDescending(a => a.CreatedAt)
            .ToListAsync();
        return Ok(analyses);
    }

    [HttpGet("payments")]
    public async Task<IActionResult> GetPayments()
    {
        var payments = await _db.Set<Payment>().AsNoTracking().OrderByDescending(p => p.PaidAt).ToListAsync();
        return Ok(payments);
    }
}

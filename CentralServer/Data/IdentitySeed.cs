using CentralServer.Models;
using Microsoft.AspNetCore.Identity;

namespace CentralServer.Data;

public static class IdentitySeed
{
    public static async Task SeedAsync(IServiceProvider services, IConfiguration config)
    {
        var roleManager = services.GetRequiredService<RoleManager<IdentityRole<int>>>();
        var userManager = services.GetRequiredService<UserManager<User>>();
        // Создаём роли
        foreach (var role in new[] { "User", "Admin" })
        {
            if (!await roleManager.RoleExistsAsync(role))
            {
                var result = await roleManager.CreateAsync(new IdentityRole<int>(role));
                if (!result.Succeeded)
                    throw new Exception("Cannot create role " + role);
            }
        }
        // Данные администратора берём из настроек
        var email = config["Admin:Email"];
        var password = config["Admin:Password"];
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
            return;
        var existingUser = await userManager.FindByEmailAsync(email);
        if (existingUser != null)
        {
            if (!await userManager.IsInRoleAsync(existingUser, "Admin"))
                throw new Exception(
                    "Admin email already belongs to another user"
                );
            return;
        }
        var admin = new User
        {
            UserName = email,
            Email = email
        };
        var createResult = await userManager.CreateAsync(
            admin, password
        );
        if (!createResult.Succeeded)
            throw new Exception("Cannot create administrator");
        var roleResult = await userManager.AddToRoleAsync(
            admin, "Admin"
        );
        if (!roleResult.Succeeded)
            throw new Exception("Cannot assign Admin role");
    }
}

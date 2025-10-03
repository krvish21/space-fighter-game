// Game Over Screen - Handles the game over overlay display and stats
class GameOverScreen {
    constructor() {
        this.isVisible = false;
    }

    show() {
        this.isVisible = true;
    }

    hide() {
        this.isVisible = false;
    }

    shouldDisplay(gameOver, gameStarted, gamePaused, finalDurationMs) {
        return gameOver && gameStarted && !gamePaused && finalDurationMs > 0;
    }

    draw(ctx, canvas, nowTs, finalDurationMs, healsConsumed, gameOver, gameStarted, gamePaused) {
        if (!this.shouldDisplay(gameOver, gameStarted, gamePaused, finalDurationMs)) {
            return;
        }

        const mins = Math.floor(finalDurationMs / 60000);
        const secs = Math.floor((finalDurationMs % 60000) / 1000);
        const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

        ctx.save();
        
        // Full screen overlay with sophisticated background
        const overlayGradient = ctx.createRadialGradient(canvas.width/2, canvas.height/2, 0, canvas.width/2, canvas.height/2, Math.max(canvas.width, canvas.height)/2);
        overlayGradient.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
        overlayGradient.addColorStop(0.6, 'rgba(26, 10, 46, 0.85)');
        overlayGradient.addColorStop(1, 'rgba(0, 0, 0, 0.95)');
        ctx.fillStyle = overlayGradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Animated grid overlay
        this.drawAnimatedGrid(ctx, canvas, nowTs);
        
        // Main game over panel
        const panelW = Math.min(550, canvas.width - 60);
        const panelH = 280;
        const panelX = (canvas.width - panelW) / 2;
        const panelY = (canvas.height - panelH) / 2;
        
        // Panel background and borders
        this.drawPanel(ctx, panelX, panelY, panelW, panelH, nowTs);
        
        // Content
        this.drawTitle(ctx, canvas, panelY, nowTs);
        this.drawStats(ctx, canvas, panelY, timeStr, healsConsumed, nowTs);
        this.drawInstructions(ctx, canvas, panelY, panelH, nowTs);
        
        ctx.restore();
    }

    drawAnimatedGrid(ctx, canvas, nowTs) {
        ctx.strokeStyle = 'rgba(255, 23, 68, 0.1)';
        ctx.lineWidth = 1;
        const gameOverGridSize = 50;
        const gameOverOffset = (nowTs * 0.02) % gameOverGridSize;
        
        for (let x = -gameOverOffset; x < canvas.width + gameOverGridSize; x += gameOverGridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
        for (let y = -gameOverOffset; y < canvas.height + gameOverGridSize; y += gameOverGridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }
    }

    drawPanel(ctx, panelX, panelY, panelW, panelH, nowTs) {
        // Panel background with enhanced gradient
        const panelGradient = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelH);
        panelGradient.addColorStop(0, 'rgba(10, 10, 26, 0.98)');
        panelGradient.addColorStop(0.2, 'rgba(26, 10, 46, 0.95)');
        panelGradient.addColorStop(0.5, 'rgba(22, 33, 62, 0.92)');
        panelGradient.addColorStop(0.8, 'rgba(16, 21, 46, 0.95)');
        panelGradient.addColorStop(1, 'rgba(0, 0, 0, 0.98)');
        ctx.fillStyle = panelGradient;
        ctx.fillRect(panelX, panelY, panelW, panelH);
        
        // Panel border with dynamic glow
        const gameOverBorderPulse = 0.7 + 0.3 * Math.sin(nowTs * 0.005);
        ctx.strokeStyle = `rgba(255, 23, 68, ${gameOverBorderPulse})`;
        ctx.lineWidth = 3;
        ctx.shadowColor = '#FF1744';
        ctx.shadowBlur = 15;
        ctx.strokeRect(panelX, panelY, panelW, panelH);
        
        // Enhanced corner decorations
        this.drawCornerDecorations(ctx, panelX, panelY, panelW, panelH);
    }

    drawCornerDecorations(ctx, panelX, panelY, panelW, panelH) {
        ctx.strokeStyle = '#00E5FF';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#00E5FF';
        ctx.shadowBlur = 10;
        const gameOverCornerSize = 35;
        
        // All four corners
        const corners = [
            [panelX, panelY], 
            [panelX + panelW, panelY], 
            [panelX, panelY + panelH], 
            [panelX + panelW, panelY + panelH]
        ];
        
        corners.forEach(([x, y], i) => {
            ctx.beginPath();
            if (i === 0) { // Top-left
                ctx.moveTo(x, y + gameOverCornerSize);
                ctx.lineTo(x, y);
                ctx.lineTo(x + gameOverCornerSize, y);
            } else if (i === 1) { // Top-right
                ctx.moveTo(x - gameOverCornerSize, y);
                ctx.lineTo(x, y);
                ctx.lineTo(x, y + gameOverCornerSize);
            } else if (i === 2) { // Bottom-left
                ctx.moveTo(x, y - gameOverCornerSize);
                ctx.lineTo(x, y);
                ctx.lineTo(x + gameOverCornerSize, y);
            } else { // Bottom-right
                ctx.moveTo(x - gameOverCornerSize, y);
                ctx.lineTo(x, y);
                ctx.lineTo(x, y - gameOverCornerSize);
            }
            ctx.stroke();
        });
    }

    drawTitle(ctx, canvas, panelY, nowTs) {
        // Title with enhanced typography
        const titlePulse = 0.8 + 0.2 * Math.sin(nowTs * 0.007);
        ctx.fillStyle = `rgba(255, 255, 255, ${titlePulse})`;
        ctx.shadowColor = '#FF1744';
        ctx.shadowBlur = 20;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = "bold 42px 'Orbitron', monospace";
        ctx.fillText('MISSION FAILED', canvas.width / 2, panelY + 70);
        
        // Mission status subtitle
        ctx.font = "14px 'Exo 2', sans-serif";
        ctx.fillStyle = 'rgba(255, 68, 68, 0.9)';
        ctx.shadowColor = '#FF1744';
        ctx.shadowBlur = 8;
        ctx.fillText('PILOT DOWN - HULL BREACH CRITICAL', canvas.width / 2, panelY + 105);
    }

    drawStats(ctx, canvas, panelY, timeStr, healsConsumed, nowTs) {
        // Stats section with enhanced layout
        const statsStartY = panelY + 145;
        const statLineSpacing = 30;
        
        // Survival time
        ctx.font = "16px 'Orbitron', monospace";
        ctx.fillStyle = '#00E5FF';
        ctx.shadowColor = '#00E5FF';
        ctx.shadowBlur = 8;
        ctx.fillText(`SURVIVAL TIME: ${timeStr}`, canvas.width / 2, statsStartY);
        
        // Heals collected
        ctx.fillStyle = '#50FA7B';
        ctx.shadowColor = '#50FA7B';
        ctx.fillText(`HEALS COLLECTED: ${healsConsumed}`, canvas.width / 2, statsStartY + statLineSpacing);
        
        // Performance rating
        const rating = healsConsumed >= 10 ? 'EXCELLENT' : healsConsumed >= 5 ? 'GOOD' : 'ROOKIE';
        const ratingColor = healsConsumed >= 10 ? '#50FA7B' : healsConsumed >= 5 ? '#F1FA8C' : '#FF6B35';
        ctx.fillStyle = ratingColor;
        ctx.shadowColor = ratingColor;
        ctx.fillText(`PERFORMANCE: ${rating}`, canvas.width / 2, statsStartY + statLineSpacing * 2);
    }

    drawInstructions(ctx, canvas, panelY, panelH, nowTs) {
        // Instructions
        const instructionY = panelY + panelH - 35;
        const titlePulse = 0.8 + 0.2 * Math.sin(nowTs * 0.007);
        ctx.font = "12px 'Exo 2', sans-serif";
        ctx.fillStyle = `rgba(255, 255, 255, ${titlePulse * 0.8})`;
        ctx.shadowColor = '#FFFFFF';
        ctx.shadowBlur = 3;
        ctx.fillText('Press ESC to return to main menu', canvas.width / 2, instructionY);
    }
}

// Create global instance
window.gameOverScreen = new GameOverScreen();
function mouseDownEvent(e) {
    const rect = piecesCanvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) * piecesCanvas.width / rect.width;
    const mouseY = (e.clientY - rect.top) * piecesCanvas.height / rect.height;
    const square = pixelToSquare(mouseX, mouseY);
    const pieceFound = pieces.find(piece => piece.file === square.file && piece.rank === square.rank);

    if (!pieceFound && dragState.selected) {
        dragState.piece = dragState.selected;
        dragState.origin = [dragState.selected.file, dragState.selected.rank];
        dragState.clickMove = true;
        return;
    }

    if (pieceFound) {
        if (dragState.selected && pieceFound !== dragState.selected && pieceFound.color !== dragState.selected.color) {
            const canCapture = genevaConventions(dragState.selected, false)
                .some(([file, rank]) => file === square.file && rank === square.rank);
            if (canCapture) {
                dragState.piece = dragState.selected;
                dragState.origin = [dragState.selected.file, dragState.selected.rank];
                dragState.clickMove = true;
                return;
            }
        }

        dragState.selected = pieceFound;
        dragState.piece = pieceFound;
        dragState.origin = [square.file, square.rank];
        dragState.clickMove = false;
        drawMovePreview(pieceFound);
        const {x: piecePixelX, y: piecePixelY} = squareToPixel(pieceFound.file, pieceFound.rank);
        dragState.offsetX = mouseX - piecePixelX;
        dragState.offsetY = mouseY - piecePixelY;
    } else {
        dragState.piece = null;
        dragState.origin = null;
        dragState.clickMove = false;
        drawPieces(dragState);
    }
}

let lastUpdate = 0;
const fpsInterval = 1000 / 240;

function formatClock(seconds) {
    const totalSeconds = Math.max(0, Math.ceil(seconds));
    const minutes = Math.floor(totalSeconds / 60);
    const remainder = totalSeconds % 60;
    return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function renderClock() {
    whiteClock.textContent = formatClock(clockRemaining[0]);
    blackClock.textContent = formatClock(clockRemaining[1]);

    for (const [color, element] of [[0, whiteClock], [1, blackClock]]) {
        const container = element.parentElement;
        container.classList.toggle("active-clock", gameState === 1 && activeClockColor === color);
        container.classList.toggle("low-time", clockRemaining[color] <= 10);
    }
}

function stopChessClock() {
    if (clockIntervalId !== null) {
        clearInterval(clockIntervalId);
        clockIntervalId = null;
    }
    activeClockColor = null;
    clockLastTick = 0;
    timerSelect.disabled = false;
    renderClock();
}

function resetChessClock() {
    stopChessClock();
    const [minutes, increment] = timerSelect.value.split("-").map(Number);
    clockInitialSeconds = minutes;
    clockIncrementSeconds = increment;
    clockRemaining = [clockInitialSeconds, clockInitialSeconds];
    renderClock();
}

function updateChessClock(now = performance.now()) {
    if (activeClockColor === null || gameState !== 1) return true;

    const elapsedSeconds = (now - clockLastTick) / 1000;
    clockLastTick = now;
    clockRemaining[activeClockColor] = Math.max(0, clockRemaining[activeClockColor] - elapsedSeconds);
    renderClock();

    if (clockRemaining[activeClockColor] <= 0) {
        endGame(false, null, true, 8);
        return false;
    }
    return true;
}

function startChessClock(color = 0) {
    if (clockIntervalId !== null) clearInterval(clockIntervalId);
    activeClockColor = color;
    clockLastTick = performance.now();
    timerSelect.disabled = true;
    renderClock();
    clockIntervalId = setInterval(() => updateChessClock(), 100);
}

function completeClockTurn(moverColor) {
    clockRemaining[moverColor] += clockIncrementSeconds;
    startChessClock(moverColor === 0 ? 1 : 0);
}

function captureGameSnapshot() {
    return {
        pieces: pieces.map(piece => ({
            type: piece.type,
            color: piece.color,
            file: piece.file,
            rank: piece.rank,
            fm: piece.fm,
            ep: piece.ep
        })),
        whiteTurn,
        enPassantTarget: enPassantTarget ? {...enPassantTarget} : null,
        halfmoveClock,
        positionCounts: [...positionCounts.entries()],
        clockRemaining: [...clockRemaining],
        activeClockColor,
        clockPreset: timerSelect.value,
        moveList: [...moveList],
        gameState,
        resultText: resultLabel.textContent
    };
}

function initializeMoveHistory() {
    moveList = [];
    boardHistory = [captureGameSnapshot()];
    historyCursor = 0;
    renderMoveHistory();
    updateHistoryControls();
}

function renderMoveHistory() {
    moveHistoryElement.replaceChildren();
    for (let index = 0; index < moveList.length; index += 2) {
        const item = document.createElement("li");
        const moveNumber = Math.floor(index / 2) + 1;
        item.textContent = `${moveNumber}. ${moveList[index]}${moveList[index + 1] ? ` ${moveList[index + 1]}` : ""}`;
        if (index + 2 >= historyCursor) item.classList.add("current");
        moveHistoryElement.append(item);
    }
    moveHistoryElement.scrollTop = moveHistoryElement.scrollHeight;
}

function updateHistoryControls() {
    undo.disabled = historyCursor <= 0;
    redo.disabled = historyCursor >= boardHistory.length - 1;
}

function recordCompletedMove(notation) {
    boardHistory = boardHistory.slice(0, historyCursor + 1);
    moveList.push(notation);
    boardHistory.push(captureGameSnapshot());
    historyCursor = boardHistory.length - 1;
    renderMoveHistory();
    updateHistoryControls();
}

function restoreHistory(index) {
    if (index < 0 || index >= boardHistory.length || index === historyCursor) return;
    if (gameState === 1) {
        piecesCanvas.removeEventListener("mousedown", mouseDownEvent);
        piecesCanvas.removeEventListener("mousemove", mouseMoveEvent);
        piecesCanvas.removeEventListener("mouseup", mouseUpEvent);
    }

    const snapshot = boardHistory[index];
    pieces = snapshot.pieces.map(piece => new Piece(piece.type, piece.color, piece.file, piece.rank, piece.fm, piece.ep));
    whiteTurn = snapshot.whiteTurn;
    syncBoardToTurn();
    enPassantTarget = snapshot.enPassantTarget ? {...snapshot.enPassantTarget} : null;
    halfmoveClock = snapshot.halfmoveClock;
    positionCounts = new Map(snapshot.positionCounts);
    clockRemaining = [...snapshot.clockRemaining];
    timerSelect.value = snapshot.clockPreset;
    const [initialSeconds, incrementSeconds] = timerSelect.value.split("-").map(Number);
    clockInitialSeconds = initialSeconds;
    clockIncrementSeconds = incrementSeconds;
    moveList = [...snapshot.moveList];
    gameState = snapshot.gameState;
    resultLabel.textContent = snapshot.resultText;
    start.disabled = gameState === 1;
    turnLabel.textContent = whiteTurn ? "White to move" : "Black to move";
    claimDraw.disabled = gameState !== 1 || ((positionCounts.get(positionKey()) ?? 0) < 3 && halfmoveClock < 100);
    updateMaterialAdvantage();
    dragState.piece = null;
    dragState.selected = null;
    dragState.origin = null;
    dragState.clickMove = false;
    clearMovePreview();
    historyCursor = index;

    if (gameState === 1 && snapshot.activeClockColor !== null) {
        startChessClock(snapshot.activeClockColor);
    } else {
        stopChessClock();
    }

    drawManualCheckerboard();
    drawPieces(dragState);
    renderMoveHistory();
    updateHistoryControls();

    if (gameState === 1) {
        piecesCanvas.addEventListener("mousedown", mouseDownEvent);
        piecesCanvas.addEventListener("mousemove", mouseMoveEvent);
        piecesCanvas.addEventListener("mouseup", mouseUpEvent);
    }
}

function undoMove() {
    restoreHistory(historyCursor - 1);
}

function redoMove() {
    restoreHistory(historyCursor + 1);
}

function mouseMoveEvent(e) {
    if (!dragState.piece) return;
    if (dragState.clickMove) return;

    const now = Date.now();
    if (now - lastUpdate < fpsInterval) return;
    lastUpdate = now;

    const rect = piecesCanvas.getBoundingClientRect();
    dragState.mouseX = (e.clientX - rect.left) * piecesCanvas.width / rect.width;
    dragState.mouseY = (e.clientY - rect.top) * piecesCanvas.height / rect.height;
    drawPieces(dragState);
}

async function mouseUpEvent(e) {
    if (dragState.piece == null) return;
    if (!updateChessClock()) return;

    const rect = piecesCanvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) * piecesCanvas.width / rect.width;
    const mouseY = (e.clientY - rect.top) * piecesCanvas.height / rect.height;
    const {file: gridX, rank: gridY} = pixelToSquare(mouseX, mouseY);

    let capturedPiece;
    let enPassantCapture = false;
    let moveMade = false;
    let orientationChanged = false;
    let movingPiece;
    let originalFile;
    let originalRank;
    let disambiguation = "";
    let isPromotion = false;
    let isCastle = false;

    if (arraysEqual(dragState.origin, [gridX, gridY])) {
        dragState.piece = null;
        dragState.origin = null;
        dragState.clickMove = false;
        drawPieces(dragState);
        return true;
    }

    if (gridX >= 1 && gridX <= 8 && gridY >= 1 && gridY <= 8) {
        if (police(dragState.piece, gridX, gridY)) {
            movingPiece = dragState.piece;
            originalFile = movingPiece.file;
            originalRank = movingPiece.rank;
            isCastle = movingPiece.type === "K" && Math.abs(gridX - originalFile) === 2;
            disambiguation = getMoveDisambiguation(movingPiece, gridX, gridY);
            let promotionChoice = null;

            if (movingPiece.type === "P" && gridY === (whiteTurn ? 8 : 1)) {
                promotionChoice = await getPromotionChoice();
                if (gameState !== 1 || !updateChessClock()) {
                    dragState.piece = null;
                    dragState.selected = null;
                    dragState.origin = null;
                    dragState.clickMove = false;
                    clearMovePreview();
                    drawPieces(dragState);
                    return;
                }
                isPromotion = true;
            }

            capturedPiece = pieces.find(piece => piece.file === gridX && piece.rank === gridY);

            if (capturedPiece) {
                pieces.splice(pieces.indexOf(capturedPiece), 1)
            }
            if (movingPiece.type === "P" && gridX !== originalFile && !capturedPiece) {
                const enPassantPawn = pieces.find(piece =>
                    piece.type === "P" && piece.color !== movingPiece.color &&
                    piece.file === gridX && piece.rank === originalRank
                );
                if (enPassantPawn) {
                    pieces.splice(pieces.indexOf(enPassantPawn), 1);
                    enPassantCapture = true;
                }
            }

            enPassantTarget = null;
            if (movingPiece.type === "P" && Math.abs(gridY - originalRank) === 2) {
                enPassantTarget = {file: gridX, rank: (gridY + originalRank) / 2};
            }

            if (movingPiece.type === "K" && Math.abs(gridX - originalFile) === 2) {
                const rookFrom = gridX > originalFile ? 8 : 1;
                const rookTo = gridX > originalFile ? gridX - 1 : gridX + 1;
                const rook = pieces.find(piece => piece.type === "R" && piece.color === movingPiece.color && piece.file === rookFrom && piece.rank === originalRank);
                if (rook) {
                    rook.file = rookTo;
                    rook.fm = false;
                }
            }

            halfmoveClock = movingPiece.type === "P" || capturedPiece ? 0 : halfmoveClock + 1;
            movingPiece.file = gridX;
            movingPiece.rank = gridY;
            movingPiece.fm = false;

            if (promotionChoice !== null) {
                switch (promotionChoice) {
                    case 1:
                        movingPiece.type = "Q";
                        break;
                    case 2:
                        movingPiece.type = "R";
                        break;
                    case 3:
                        movingPiece.type = "B";
                        break;
                    case 4:
                        movingPiece.type = "N";
                        break;
                }
            }

            updateMaterialAdvantage();
            completeClockTurn(movingPiece.color);
            whiteTurn = whiteTurn ? false : true;
            const previousOrientation = boardReversed;
            syncBoardToTurn();
            orientationChanged = previousOrientation !== boardReversed;
            turnLabel.textContent = whiteTurn ? "White to move" : "Black to move";
            recordPosition();
            moveMade = true;
        }
        else {
            sfxCache["illegal"].play();
        }
    }

    dragState.piece = null;
    dragState.origin = null;
    dragState.clickMove = false;
    if (orientationChanged) drawManualCheckerboard();
    drawPieces(dragState);
    if (!moveMade) return;

    clearMovePreview();
    dragState.selected = null;

    if (gameState === 1) evaluateDraws();
    const checkedColor = whiteTurn ? 0 : 1;
    const isCheck = checkCheck(checkedColor);
    const isCheckmate = gameState === 0 && resultLabel.textContent.includes("checkmate");
    const notation = addMove({
        type: isPromotion ? "P" : movingPiece.type,
        file: gridX,
        rank: gridY,
        originFile: originalFile,
        capture: Boolean(capturedPiece || enPassantCapture),
        check: isCheck && !isCheckmate,
        checkmate: isCheckmate,
        promotion: isPromotion,
        promotionT: isPromotion ? movingPiece.type : null,
        castle: isCastle,
        castleK: isCastle && gridX > originalFile,
        disamb: disambiguation
    });
    recordCompletedMove(notation);

    if (isCheck) {
        sfxCache["move-check"].play();
        drawManualCheckerboard();
    }
    else if (capturedPiece || enPassantCapture) sfxCache["capture"].play();
    else if (!isCastle) sfxCache["move-self"].play();
    if (isCastle) sfxCache["castle"].play();
    if (isPromotion) sfxCache["promote"].play();
}

async function initGame() {
    const isMobile = window.matchMedia("(pointer: coarse)").matches;
    
    if (isMobile) document.body.style.flexDirection = "column"

    drawManualCheckerboard();
    resetPiecesArray();
    drawManualCheckerboard();
    await preloadAssets();
    drawPieces(dragState);

    reverse.onclick = reverseBoardView;
    rotateWithTurn.addEventListener("change", () => {
        syncBoardToTurn();
        drawManualCheckerboard();
        drawPieces(dragState);
    });

    start.onclick = () => {
        startGame();
    };

    reset.onclick = () => {
        endGame(false, null, true, 5)
        resetPiecesArray();
        resetChessClock();
        drawManualCheckerboard();
        dragState.selected = null;
        dragState.piece = null;
        dragState.origin = null;
        dragState.clickMove = false;
        clearMovePreview();
        drawPieces(dragState);
    }

    claimDraw.onclick = claimDrawNow;
    undo.onclick = undoMove;
    redo.onclick = redoMove;
    timerSelect.onchange = resetChessClock;
    resetChessClock();
}

function startGame(){
    stopChessClock();
    piecesCanvas.removeEventListener('mousedown', mouseDownEvent);
    piecesCanvas.removeEventListener("mousemove", mouseMoveEvent);
    piecesCanvas.removeEventListener("mouseup", mouseUpEvent);
    gameState = 0;
    resetPiecesArray();
    drawManualCheckerboard();
    drawPieces(dragState);

    const unlockAudio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==');
    unlockAudio.play()
        .then(() => console.log("Audio engine successfully unlocked for the session!"))
        .catch(err => console.error(err));
 
    sfxCache["game-start"].play();

    document.getElementById("ulPlaceholder").hidden = true;

    gameState = 1;
    start.disabled = true;
    resultLabel.textContent = "Ongoing Game";
    resetChessClock();
    startChessClock(0);
    initializeMoveHistory();
    piecesCanvas.addEventListener('mousedown', mouseDownEvent);
    piecesCanvas.addEventListener("mousemove", mouseMoveEvent);
    piecesCanvas.addEventListener("mouseup", mouseUpEvent);
}

initGame();
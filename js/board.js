function drawManualCheckerboard(){
    boardCtx.clearRect(0, 0, boardCanvas.width, boardCanvas.height);

    const lightColor = "#eeeed2";
    const darkColor  = "#769656";

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            let x = c * tileSize;
            let y = r * tileSize;

            boardCtx.fillStyle = (r + c) % 2 === 0 ? lightColor : darkColor;
            boardCtx.fillRect(x, y, tileSize, tileSize);
        }
    }
}

function preloadAssets(){
    const promises = [];

    const sfxFileNames = ["capture.mp3", "castle.mp3", "game-end.mp3", "game-start.mp3", "illegal.mp3", "move-check.mp3", "move-opponent.mp3", "move-self.mp3", "premove.mp3", "promote.mp3", "tenseconds.mp3"];

    for (const type of pieceTypeArray) {
        for (const color of [0, 1]) {
            const imgPromise = new Promise((resolve, reject) => {
                const img = new Image();
                img.src = `images/${color}${type}.png`;

                img.onload = () => {
                    pieceImageCache[`${color}${type}`] = img;
                    resolve();
                };
                img.onerror = () => reject(new Error(`Failed to load images/${color}${type}.png`));
            });
            promises.push(imgPromise);
        }
        for (const name of sfxFileNames) {
            const sfxPromise = new Promise((resolve, reject) => {
                const sfx = new Audio(`sfx/${name}`);
                    sfx.muted = !userSettings.sfxEnabled;

                sfx.oncanplaythrough = () => {
                    sfxCache[name.slice(0, -4)] = (sfx)
                    resolve();
                };
                sfx.onerror = () => reject(new Error(`Failed to load sfx/${name}`));
            });
            promises.push(sfxPromise);
        }
    }
    return Promise.all(promises);
}

function squareToPixel(file, rank) {
    return {
        x: (boardReversed ? 8 - file : file - 1) * tileSize,
        y: (boardReversed ? rank - 1 : 8 - rank) * tileSize
    };
}

function pixelToSquare(x, y) {
    const column = Math.floor(x / tileSize);
    const row = Math.floor(y / tileSize);
    return {
        file: boardReversed ? 8 - column : column + 1,
        rank: boardReversed ? row + 1 : 8 - row
    };
}

function clearMovePreview() {
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
}

function drawMovePreview(piece) {
    clearMovePreview();
    if (!piece || gameState !== 1 || piece.color !== (whiteTurn ? 0 : 1)) return;

    const legalMoves = genevaConventions(piece, false);
    for (const [file, rank] of legalMoves) {
        const {x, y} = squareToPixel(file, rank);
        const targetPiece = pieces.find(candidate => candidate.file === file && candidate.rank === rank);
        const isCapture = targetPiece || (piece.type === "P" && file !== piece.file);
        const centerX = x + tileSize / 2;
        const centerY = y + tileSize / 2;

        previewCtx.beginPath();
        if (isCapture) {
            previewCtx.strokeStyle = "rgba(35, 35, 35, 0.58)";
            previewCtx.lineWidth = Math.max(4, tileSize * 0.075);
            previewCtx.arc(centerX, centerY, tileSize * 0.42, 0, Math.PI * 2);
            previewCtx.stroke();
        } else {
            previewCtx.fillStyle = "rgba(35, 35, 35, 0.38)";
            previewCtx.arc(centerX, centerY, tileSize * 0.14, 0, Math.PI * 2);
            previewCtx.fill();
        }
    }
}

function drawPieces(drag){
    piecesCtx.clearRect(0, 0, piecesCanvas.width, piecesCanvas.height);

    const drawPiece = (piece, x, y) => {
        const pieceImg = pieceImageCache[`${piece.color}${piece.type}`];
        const isCheckedKing = piece.type === "K" && checkCheck(piece.color);

        piecesCtx.save();
        if (isCheckedKing) {
            piecesCtx.shadowColor = "rgba(255, 24, 24, 0.95)";
            piecesCtx.shadowBlur = 24;
        }
        piecesCtx.drawImage(pieceImg, x, y, tileSize, tileSize);
        piecesCtx.restore();
    };

    for (const piece of pieces) {
        if (piece === drag.piece) {
            continue;
        }
        else {
            const {x, y} = squareToPixel(piece.file, piece.rank);
            drawPiece(piece, x, y);
        }
    }
    if (drag.piece){
        drawPiece(drag.piece, drag.mouseX - drag.offsetX, drag.mouseY - drag.offsetY);
    }
}

function syncBoardToTurn() {
    reverse.disabled = rotateWithTurn.checked;
    if (rotateWithTurn.checked) boardReversed = !whiteTurn;
}

function resetPiecesArray(){
    pieces = [];
    moveList = [];
    enPassantTarget = null;
    whiteTurn = true;
    fullmoveNumber = 1;
    gameStartFEN = null;
    gameStartWhiteTurn = true;
    gameStartFullmoveNumber = 1;
    syncBoardToTurn();
    halfmoveClock = 0;
    positionCounts = new Map();
    turnLabel.textContent = "White to move";
    dragState.selected = null;
    dragState.piece = null;
    dragState.origin = null;
    dragState.clickMove = false;

    for(const type of pieceTypeArray) {
        switch(type) {
            case 'K':
                pieces.push(new Piece(type, 0, 5, 1));
                pieces.push(new Piece(type, 1, 5, 8));
                break;
            case 'Q':
                pieces.push(new Piece(type, 0, 4, 1));
                pieces.push(new Piece(type, 1, 4, 8));
                break;
            case 'R':
                pieces.push(new Piece(type, 0, 1, 1));
                pieces.push(new Piece(type, 0, 8, 1));
                pieces.push(new Piece(type, 1, 1, 8));
                pieces.push(new Piece(type, 1, 8, 8));
                break;
            case 'N':
                pieces.push(new Piece(type, 0, 2, 1));
                pieces.push(new Piece(type, 0, 7, 1));
                pieces.push(new Piece(type, 1, 2, 8));
                pieces.push(new Piece(type, 1, 7, 8));
                break;
            case 'B':
                pieces.push(new Piece(type, 0, 3, 1));
                pieces.push(new Piece(type, 0, 6, 1));
                pieces.push(new Piece(type, 1, 3, 8));
                pieces.push(new Piece(type, 1, 6, 8));
                break;
            case 'P':
                for (let i = 0; i < 8; i++) {
                    pieces.push(new Piece(type, 0, i+1, 2));
                    pieces.push(new Piece(type, 1, i+1, 7));
                }
                break;
            default:
                throw new Error("i think i miss my pieces");
        }
    }

    recordPosition();
    claimDraw.disabled = true;
    initializeMoveHistory();
    updateMaterialAdvantage();
}

function reverseBoardView() {
    boardReversed = !boardReversed;
    dragState.selected = null;
    dragState.piece = null;
    dragState.origin = null;
    dragState.clickMove = false;
    clearMovePreview();
    drawManualCheckerboard();
    drawPieces(dragState);
}
function police(piece, file, rank){
    if (whiteTurn && piece.color == 1) return false;
    if (!whiteTurn && piece.color == 0) return false;

    const legalMoves = genevaConventions(piece, false);
    const isMoveLegal = legalMoves.some(move => move[0] === file && move[1] === rank);

    console.log(legalMoves);
    console.log(isMoveLegal);

    if (!isMoveLegal) return false;
    return true;
}

function isSquareAttacked(file, rank, byColor) {
    for (const piece of pieces) {
        if (piece.color !== byColor) continue;

        const attacks = genevaConventions(piece, true);
        if (attacks.some(square => square[0] === file && square[1] === rank)) return true;
    }

    return false;
}

function isKingSquareSafe(king, file, rank) {
    const originalFile = king.file;
    const originalRank = king.rank;
    king.file = file;
    king.rank = rank;
    const safe = !checkCheck(king.color);
    king.file = originalFile;
    king.rank = originalRank;
    return safe;
}

function canCastle(king, kingSide) {
    const homeRank = king.color === 0 ? 1 : 8;
    const rookFile = kingSide ? 8 : 1;
    const rook = pieces.find(piece => piece.type === "R" && piece.color === king.color && piece.file === rookFile && piece.rank === homeRank);

    if (king.type !== "K" || king.file !== 5 || king.rank !== homeRank || !king.fm || !rook || !rook.fm) {
        return false;
    }

    const emptyFiles = kingSide ? [6, 7] : [2, 3, 4];
    if (emptyFiles.some(file => pieces.some(piece => piece.file === file && piece.rank === homeRank))) {
        return false;
    }

    const transitFile = kingSide ? 6 : 4;
    return isKingSquareSafe(king, king.file, homeRank) && isKingSquareSafe(king, transitFile, homeRank);
}

function genevaConventions(piece, stage1only) {
    if (piece == null) return [];

    let stage1Legal = [];

    const slidingPieces = directions => {
        for (const [fileDirection, rankDirection] of directions) {
            let file = piece.file + fileDirection;
            let rank = piece.rank + rankDirection;

            while (file >= 1 && file <= 8 && rank >= 1 && rank <= 8) {
                const obstacle = pieces.find(piece => piece.file === file && piece.rank === rank);

                if (obstacle) {
                    if (obstacle.color !== piece.color) {
                        stage1Legal.push([file, rank]);
                    }
                    break;
                }

                stage1Legal.push([file, rank]);
                file += fileDirection;
                rank += rankDirection;
            }
        }
    };
    const staticPieces = deltas => {
        for (const [xDelta, yDelta] of deltas) {
            const file = piece.file + xDelta;
            const rank = piece.rank + yDelta;

            if (file > 8 || file < 1 || rank > 8 || rank < 1) {
                continue;
            }

            const obstacle = pieces.find(piece => piece.file === file && piece.rank === rank);

            if (obstacle) {
                if (obstacle.color !== piece.color) {
                    stage1Legal.push([file, rank]);
                }
                continue;
            }

            stage1Legal.push([file, rank]);
        }
    };

    const NDeltas = [
        [1, 2], [-1, 2], [2, 1], [2, -1],
        [1, -2], [-1, -2], [-2, 1], [-2, -1]
    ];
    const KDeltas = [
        [-1, 1], [0, 1], [1, 1], [-1, 0],
        [1, 0], [-1, -1], [0, -1], [1, -1]
    ];
    const RDirections = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const BDirections = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
    const QDirections = [...RDirections, ...BDirections];

    switch (piece.type) {
        case "R":
            slidingPieces(RDirections);
            break;
        case "B":
            slidingPieces(BDirections);
            break;
        case "Q":
            slidingPieces(QDirections);
            break;
        case "N":
            staticPieces(NDeltas);
            break;
        case "K":
            staticPieces(KDeltas);
            if (!stage1only) {
                if (canCastle(piece, true)) stage1Legal.push([7, piece.rank]);
                if (canCastle(piece, false)) stage1Legal.push([3, piece.rank]);
            }
            break;
        case "P": {
            const dir = piece.color === 0 ? 1 : -1;
            if (stage1only) {
                for (const fileOffset of [-1, 1]) {
                    const file = piece.file + fileOffset;
                    const rank = piece.rank + dir;
                    if (file >= 1 && file <= 8 && rank >= 1 && rank <= 8) {
                        stage1Legal.push([file, rank]);
                    }
                }
                break;
            }

            const mvSquare1 = [piece.file, piece.rank + dir];
            const mvSquare2 = [piece.file, piece.rank + (2 * dir)];
            const captureSquare1 = [piece.file + 1, piece.rank + dir];
            const captureSquare2 = [piece.file - 1, piece.rank + dir];

            const obstacle1 = pieces.find(piece => piece.file === mvSquare1[0] && piece.rank === mvSquare1[1]);
            const obstacle2 = pieces.find(piece => piece.file === mvSquare2[0] && piece.rank === mvSquare2[1]);
            const capture1 = pieces.find(piece => piece.file === captureSquare1[0] && piece.rank === captureSquare1[1]);
            const capture2 = pieces.find(piece => piece.file === captureSquare2[0] && piece.rank === captureSquare2[1]);

            if (capture1 && capture1.color !== piece.color) stage1Legal.push(captureSquare1);
            if (capture2 && capture2.color !== piece.color) stage1Legal.push(captureSquare2);

            if (!obstacle1) {
                stage1Legal.push(mvSquare1);
                if (!obstacle2 && piece.fm) {
                    stage1Legal.push(mvSquare2);
                }
            }

            if (enPassantTarget && enPassantTarget.rank === piece.rank + dir &&
                Math.abs(enPassantTarget.file - piece.file) === 1) {
                const vulnerablePawn = pieces.find(candidate =>
                    candidate.type === "P" && candidate.color !== piece.color &&
                    candidate.file === enPassantTarget.file && candidate.rank === piece.rank
                );
                if (vulnerablePawn) stage1Legal.push([enPassantTarget.file, enPassantTarget.rank]);
            }
            break;
        }
    }

    if (stage1only) return stage1Legal;
    return constitution(piece, stage1Legal, piece.color);
}

function constitution(piece, moveList, color) {
    let finalVerdict = [];
    const originalPieces = pieces.slice();
    const originalPieceStates = new Map(originalPieces.map(piece => [piece, {
        file: piece.file,
        rank: piece.rank,
        fm: piece.fm,
        ep: piece.ep,
        type: piece.type
    }]));
    const originalFile = piece.file;
    const originalRank = piece.rank;

    for (const [file, rank] of moveList) {
        pieces.splice(0, pieces.length, ...originalPieces);
        for (const [piece, state] of originalPieceStates) Object.assign(piece, state);
        const capturedPiece = pieces.find(piece => piece.file === file && piece.rank === rank);
        if (capturedPiece) pieces.splice(pieces.indexOf(capturedPiece), 1);

        if (piece.type === "P" && file !== originalFile && !capturedPiece) {
            const enPassantPawn = pieces.find(piece =>
                piece.type === "P" && piece.color !== color &&
                piece.file === file && piece.rank === originalRank
            );
            if (enPassantPawn) pieces.splice(pieces.indexOf(enPassantPawn), 1);
        }

        piece.file = file;
        piece.rank = rank;

        if (piece.type === "K" && Math.abs(file - originalFile) === 2) {
            const rookFrom = file > originalFile ? 8 : 1;
            const rookTo = file > originalFile ? file - 1 : file + 1;
            const rook = pieces.find(piece => piece.type === "R" && piece.color === color && piece.file === rookFrom && piece.rank === originalRank);
            if (rook) rook.file = rookTo;
        }

        if (!checkCheck(color)) finalVerdict.push([file, rank]);
    }

    pieces.splice(0, pieces.length, ...originalPieces);
    for (const [piece, state] of originalPieceStates) Object.assign(piece, state);
    return finalVerdict;
}

function checkCheck(color) {
    const king = pieces.find(piece => piece.type == "K" && piece.color == color);
    if (!king) return false;
    return isSquareAttacked(king.file, king.rank, color === 0 ? 1 : 0);
}

function checkCheckmate() {
    if (!hasLegalMoves(whiteTurn ? 0 : 1)) {
        if (checkCheck(whiteTurn ? 0 : 1)) {
            const winner = whiteTurn ? 1 : 0;
            endGame(true, winner);
        } else {
            endGame(false, null, true, 1);
        }
    }
}

function positionKey() {
    const placement = pieces
        .map(piece => `${piece.color}${piece.type}${piece.file}${piece.rank}`)
        .sort()
        .join(",");
    const castlingRights = [
        [0, 1, 8], [0, 1, 1],
        [1, 8, 8], [1, 8, 1]
    ].map(([color, rank, rookFile]) => {
        const king = pieces.find(piece => piece.type === "K" && piece.color === color);
        const rook = pieces.find(piece => piece.type === "R" && piece.color === color && piece.file === rookFile && piece.rank === rank);
        return king && king.file === 5 && king.rank === rank && king.fm && rook && rook.fm ? "1" : "0";
    }).join("");
    const activeColor = whiteTurn ? 0 : 1;
    const canEnPassant = enPassantTarget && pieces.some(piece =>
        piece.type === "P" && piece.color === activeColor &&
        genevaConventions(piece, false).some(([file, rank]) =>
            file === enPassantTarget.file && rank === enPassantTarget.rank
        )
    );
    const enPassantFile = canEnPassant ? enPassantTarget.file : "-";

    return `${placement}|${whiteTurn ? 0 : 1}|${castlingRights}|${enPassantFile}`;
}

function recordPosition() {
    const key = positionKey();
    const count = (positionCounts.get(key) ?? 0) + 1;
    positionCounts.set(key, count);
    claimDraw.disabled = count < 3 && halfmoveClock < 100;
    return count;
}

function hasInsufficientMaterial() {
    const material = pieces.filter(piece => piece.type !== "K");
    if (material.length === 0) return true;
    if (material.some(piece => ["P", "R", "Q"].includes(piece.type))) return false;

    const knights = material.filter(piece => piece.type === "N");
    const bishops = material.filter(piece => piece.type === "B");
    if (material.length === 1) return true;
    if (knights.length === 0) {
        const bishopSquareColors = new Set(bishops.map(piece => (piece.file + piece.rank) % 2));
        return bishopSquareColors.size === 1;
    }

    return false;
}

function updateMaterialAdvantage() {
    const pieceValues = {P: 1, N: 3, B: 3, R: 5, Q: 9};
    const materialByColor = [0, 0];

    for (const piece of pieces) {
        materialByColor[piece.color] += pieceValues[piece.type] ?? 0;
    }

    const advantage = materialByColor[0] - materialByColor[1];
    whiteMaterialAdvantage.textContent = advantage > 0 ? `+${advantage}` : advantage === 0 ? "0" : "";
    blackMaterialAdvantage.textContent = advantage < 0 ? `+${Math.abs(advantage)}` : advantage === 0 ? "0" : "";
}

function evaluateDraws() {
    const activeColor = whiteTurn ? 0 : 1;
    if (!hasLegalMoves(activeColor)) {
        if (checkCheck(activeColor)) {
            endGame(true, activeColor === 0 ? 1 : 0);
        } else {
            endGame(false, null, true, 1);
        }
        return true;
    }

    if (hasInsufficientMaterial()) {
        endGame(false, null, true, 2);
        return true;
    }

    const repetitions = positionCounts.get(positionKey()) ?? 0;
    if (repetitions >= 5) {
        endGame(false, null, true, 6);
        return true;
    }
    if (halfmoveClock >= 150) {
        endGame(false, null, true, 7);
        return true;
    }

    return false;
}

function claimDrawNow() {
    if (gameState !== 1) return;
    if ((positionCounts.get(positionKey()) ?? 0) >= 3) {
        endGame(false, null, true, 3);
    } else if (halfmoveClock >= 100) {
        endGame(false, null, true, 4);
    }
}

async function getPromotionChoice() {
    promotionDiv.hidden = false;
    const choice = await new Promise(resolve => {
        const handlePromote = () => {
            const selectedType = Number(promotionDrop.value);
            if (selectedType >= 1 && selectedType <= 4) {
                promoteBtn.removeEventListener('click', handlePromote);
                resolve(selectedType);
            }
        };
        promoteBtn.addEventListener('click', handlePromote);
    });

    promotionDiv.hidden = true;
    promotionDrop.value = 0;
    return choice;
}

function hasLegalMoves(color) {
    for (const piece of pieces) {
        if (piece.color !== color) continue;

        if (genevaConventions(piece, false).length > 0) return true;
    }
    return false;
}

function getMoveDisambiguation(piece, file, rank) {
    if (piece.type === "P") return "";

    const competitors = pieces.filter(candidate =>
        candidate !== piece && candidate.color === piece.color && candidate.type === piece.type &&
        genevaConventions(candidate, false).some(([candidateFile, candidateRank]) =>
            candidateFile === file && candidateRank === rank
        )
    );
    if (competitors.length === 0) return "";

    const toFileChar = squareFile => String.fromCharCode(96 + squareFile);
    if (!competitors.some(candidate => candidate.file === piece.file)) {
        return toFileChar(piece.file);
    }
    if (!competitors.some(candidate => candidate.rank === piece.rank)) {
        return String(piece.rank);
    }
    return `${toFileChar(piece.file)}${piece.rank}`;
}

function addMove(
    {
        type,
        file,
        rank,
        originFile = null,
        capture = false,
        check = false,
        checkmate = false,
        promotion = false,
        promotionT = null,
        castle = false,
        castleK = false,
        disamb = ""
    }
) {
    let algNotation = "";
    const toFileChar = (file) => String.fromCharCode(96 + file);

    if (castle){
        algNotation = castleK ? "O-O" : "O-O-O";
        if (checkmate) algNotation += "#";
        else if (check) algNotation += "+";
        return algNotation;
    }

    if (type === "P") {
        if (capture) algNotation += toFileChar(originFile);
    } else {
        algNotation += type;
        algNotation += disamb;
    }

    if (capture) algNotation += "x";
    algNotation += `${toFileChar(file)}${rank}`;

    if (promotion) {
        if (!["Q", "R", "B", "N"].includes(promotionT)) {
            throw new Error(`Invalid promotion piece: ${promotionT}`);
        }
        algNotation += `=${promotionT}`;
    }

    if (checkmate) algNotation += "#";
    else if (check) algNotation += "+";
    return algNotation;
}

function endGame(checkmate, winner=null, draw, drawType=0) {
    if (gameState == 1) {
        if (checkmate) {
            resultLabel.textContent = `${winner == 0 ? "White" : "Black"} won by checkmate.`;
        }
        else if (draw) {
            switch (drawType) {
                case 1:
                    resultLabel.textContent = `Draw by Stalemate.`;
                    break;
                case 2:
                    resultLabel.textContent = `Draw by Insufficient Material.`;
                    break;
                case 3:
                    resultLabel.textContent = `Draw by Threefold Repetition.`;
                    break;
                case 4:
                    resultLabel.textContent = `Draw by 50-move rule.`;
                    break;
                case 5:
                    resultLabel.textContent = `Mutual Draw.`;
                    break;
                case 6:
                    resultLabel.textContent = `Draw by Fivefold Repetition.`;
                    break;
                case 7:
                    resultLabel.textContent = `Draw by 75-move rule.`;
                    break;
                case 8:
                    resultLabel.textContent = `${activeClockColor === 0 ? "Black" : "White"} won on time.`;
                    break;
            }
        }

        playSfx("game-end");
        gameState = 0;
        start.disabled = false;
        stopChessClock();
        claimDraw.disabled = true;
        piecesCanvas.removeEventListener('mousedown', mouseDownEvent);
        piecesCanvas.removeEventListener("mousemove", mouseMoveEvent);
        piecesCanvas.removeEventListener("mouseup", mouseUpEvent);
    }
}
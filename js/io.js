const settingsDialog = document.getElementById("settingsDialog");
const settingsButton = document.getElementById("settingsButton");
const settingsClose = document.getElementById("settingsClose");
const movePreviewSetting = document.getElementById("movePreviewSetting");
const premovesSetting = document.getElementById("premovesSetting");
const multiplePremovesSetting = document.getElementById("multiplePremovesSetting");
const sfxSetting = document.getElementById("sfxSetting");
const settingsStorageKey = "chess-user-settings";
const userSettingKeys = [
    "movePreviewEnabled",
    "premovesEnabled",
    "multiplePremovesEnabled",
    "syncBoardOrientationToTurn",
    "sfxEnabled"
];

function booleanSettings(source) {
    return Object.fromEntries(userSettingKeys
        .filter(key => typeof source?.[key] === "boolean")
        .map(key => [key, source[key]]));
}

function updateSettingsControls() {
    movePreviewSetting.checked = userSettings.movePreviewEnabled;
    premovesSetting.checked = userSettings.premovesEnabled;
    multiplePremovesSetting.checked = userSettings.multiplePremovesEnabled;
    multiplePremovesSetting.disabled = !userSettings.premovesEnabled;
    rotateWithTurn.checked = userSettings.syncBoardOrientationToTurn;
    sfxSetting.checked = userSettings.sfxEnabled;
}

function saveUserSettings() {
    try {
        localStorage.setItem(settingsStorageKey, JSON.stringify(userSettings));
    } catch {
        console.error("localStorage is unavailable.")
    }
}

function applyUserSettings() {
    updateSettingsControls();
    syncBoardToTurn();
    drawManualCheckerboard();
    if (Object.keys(pieceImageCache).length === 12) drawPieces(dragState);
    for (const sound of Object.values(sfxCache)) sound.muted = !userSettings.sfxEnabled;
}

async function loadUserSettings() {
    let configuredSettings = {};
    try {
        const response = await fetch(new URL("../settings.json", import.meta.url));
        if (!response.ok) throw new Error("Could not load settings.json.");
        configuredSettings = (await response.json()).user ?? {};
    } catch {
        configuredSettings = {};
    }

    let savedSettings = {};
    try {
        savedSettings = JSON.parse(localStorage.getItem(settingsStorageKey) ?? "{}");
    } catch {
        savedSettings = {};
    }

    userSettings = {
        ...userSettings,
        ...booleanSettings(configuredSettings),
        ...booleanSettings(savedSettings)
    };
    applyUserSettings();
}

settingsButton.addEventListener("click", () => settingsDialog.showModal());
settingsClose.addEventListener("click", () => settingsDialog.close());

for (const [control, key] of [
    [movePreviewSetting, "movePreviewEnabled"],
    [premovesSetting, "premovesEnabled"],
    [multiplePremovesSetting, "multiplePremovesEnabled"],
    [rotateWithTurn, "syncBoardOrientationToTurn"],
    [sfxSetting, "sfxEnabled"]
]) {
    control.addEventListener("change", () => {
        userSettings[key] = control.checked;
        saveUserSettings();
        applyUserSettings();
        if (key === "movePreviewEnabled" && !control.checked) clearMovePreview();
    });
}

const textDisplayDialog = document.getElementById("textDisplayDialog");
const textDisplayTitle = document.getElementById("textDisplayTitle");
const textDisplayText = document.getElementById("textDisplayText");
const textDisplayStatus = document.getElementById("textDisplayStatus");
const textDisplayCopy = document.getElementById("textDisplayCopy");
const textDisplayClose = document.getElementById("textDisplayClose");
const textDisplaySubmit = document.getElementById("textDisplaySubmit");

function textDisplay(input, output = "", title = "Text", copy = true) {
    if (textDisplayDialog.open) {
        return Promise.reject(new Error("The text display dialog is already open."));
    }

    const expectsInput = Boolean(input);
    textDisplayTitle.textContent = title;
    textDisplayText.value = expectsInput ? "" : String(output ?? "");
    textDisplayText.readOnly = !expectsInput;
    textDisplayText.setAttribute("aria-label", expectsInput ? "Enter text" : "Displayed text");
    textDisplaySubmit.hidden = !expectsInput;
    textDisplayStatus.textContent = "";
    textDisplayCopy.hidden = !expectsInput && !copy ? true : false 

    return new Promise(resolve => {
        textDisplayDialog.addEventListener("close", () => {
            resolve(expectsInput ? textDisplayText.value : undefined);
        }, {once: true});

        textDisplayDialog.showModal();
        textDisplayText.focus();
    });
}

textDisplayCopy.addEventListener("click", async () => {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(textDisplayText.value);
        } else {
            textDisplayText.select();
            if (!document.execCommand("copy")) throw new Error("Copy command failed.");
        }
        textDisplayStatus.textContent = "Copied";
    } catch {
        textDisplayStatus.textContent = "Copy failed";
    }
});

textDisplayClose.addEventListener("click", () => textDisplayDialog.close("close"));
textDisplaySubmit.addEventListener("click", () => textDisplayDialog.close("submit"));

textDisplayText.addEventListener("keydown", event => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && !textDisplaySubmit.hidden) {
        textDisplayDialog.close("submit");
    }
});

function exportPGN() {
    const now = new Date();
    const date = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`;
    const resultText = resultLabel.textContent;
    let result = "*";

    if (gameState !== 1 && moveList.length > 0) {
        if (resultText.startsWith("White won")) result = "1-0";
        else if (resultText.startsWith("Black won")) result = "0-1";
        else if (resultText.startsWith("Draw") || resultText === "Mutual Draw.") result = "1/2-1/2";
    }
    const termination = result === "*"
        ? "unterminated"
        : resultText.includes("on time") ? "time forfeit" : "normal";

    const [initialSeconds, incrementSeconds] = timerSelect.value.split("-");
    const tags = [
        `[Event "Casual ${gameType} Game"]`,
        `[Site "https://adoolaturayk.github.io/web-stuff/chess"]`,
        `[Date "${date}"]`,
        `[Round "-"]`,
        `[White "White"]`,
        `[Black "Black"]`,
        `[Result "${result}"]`,
        `[Termination "${termination}"]`,
        `[PlyCount "${moveList.length}"]`,
        `[TimeControl "${initialSeconds}+${incrementSeconds}"]`
    ];
    if (gameStartFEN) tags.splice(3, 0, `[SetUp "1"]`, `[FEN "${gameStartFEN}"]`);

    const moveText = [];
    let index = 0;
    let moveNumber = gameStartFullmoveNumber;
    if (!gameStartWhiteTurn && moveList.length > 0) {
        moveText.push(`${moveNumber}... ${moveList[index]}`);
        index++;
        moveNumber++;
    }
    for (; index < moveList.length; index += 2, moveNumber++) {
        moveText.push(`${moveNumber}. ${moveList[index]}`);
        if (moveList[index + 1]) moveText.push(moveList[index + 1]);
    }
    moveText.push(result);

    return `${tags.join("\n")}\n\n${moveText.join(" ")}\n`;
}
function exportFEN() {
    const pieceSymbols = {K: "k", Q: "q", R: "r", B: "b", N: "n", P: "p"};
    const ranks = [];

    for (let rank = 8; rank >= 1; rank--) {
        let row = "";
        let emptySquares = 0;

        for (let file = 1; file <= 8; file++) {
            const piece = pieces.find(candidate => candidate.file === file && candidate.rank === rank);
            if (!piece) {
                emptySquares++;
                continue;
            }

            if (emptySquares > 0) {
                row += emptySquares;
                emptySquares = 0;
            }
            const symbol = pieceSymbols[piece.type];
            row += piece.color === 0 ? symbol.toUpperCase() : symbol;
        }

        if (emptySquares > 0) row += emptySquares;
        ranks.push(row);
    }

    const castlingRights = [];
    for (const [color, homeRank, kingSideFile, queenSideFile] of [[0, 1, 8, 1], [1, 8, 8, 1]]) {
        const king = pieces.find(piece => piece.type === "K" && piece.color === color);
        if (!king || king.file !== 5 || king.rank !== homeRank || !king.fm) continue;

        const kingSideRook = pieces.find(piece => piece.type === "R" && piece.color === color && piece.file === kingSideFile && piece.rank === homeRank && piece.fm);
        const queenSideRook = pieces.find(piece => piece.type === "R" && piece.color === color && piece.file === queenSideFile && piece.rank === homeRank && piece.fm);
        if (kingSideRook) castlingRights.push(color === 0 ? "K" : "k");
        if (queenSideRook) castlingRights.push(color === 0 ? "Q" : "q");
    }

    const castling = castlingRights.join("") || "-";
    const enPassant = enPassantTarget
        ? `${String.fromCharCode(96 + enPassantTarget.file)}${enPassantTarget.rank}`
        : "-";
    const activeColor = whiteTurn ? "w" : "b";

    return `${ranks.join("/")} ${activeColor} ${castling} ${enPassant} ${halfmoveClock} ${fullmoveNumber}`;
}

function parseFEN(fenText) {
    const fields = fenText.trim().split(/\s+/);
    if (fields.length !== 6) throw new Error("FEN must contain six fields.");

    const [placement, activeColorField, castlingField, enPassantField, halfmoveField, fullmoveField] = fields;
    const fenPieceTypes = {k: "K", q: "Q", r: "R", b: "B", n: "N", p: "P"};
    const parsedPieces = [];
    const ranks = placement.split("/");
    if (ranks.length !== 8) throw new Error("FEN piece placement must contain eight ranks.");

    for (let rankIndex = 0; rankIndex < 8; rankIndex++) {
        let file = 1;
        for (const symbol of ranks[rankIndex]) {
            if (/^[1-8]$/.test(symbol)) {
                file += Number(symbol);
                continue;
            }

            const type = fenPieceTypes[symbol.toLowerCase()];
            if (!type || file > 8) throw new Error("FEN contains an invalid piece placement.");
            const color = symbol === symbol.toUpperCase() ? 0 : 1;
            parsedPieces.push(new Piece(type, color, file, 8 - rankIndex, false));
            file++;
        }
        if (file !== 9) throw new Error("Each FEN rank must describe exactly eight squares.");
    }

    for (const color of [0, 1]) {
        if (parsedPieces.filter(piece => piece.type === "K" && piece.color === color).length !== 1) {
            throw new Error("FEN must contain exactly one king for each side.");
        }
    }
    if (activeColorField !== "w" && activeColorField !== "b") {
        throw new Error("FEN active color must be 'w' or 'b'.");
    }
    const whiteToMove = activeColorField === "w";

    const validRights = new Set(["K", "Q", "k", "q"]);
    const castlingRights = castlingField === "-" ? [] : [...castlingField];
    if (castlingRights.some(right => !validRights.has(right)) || new Set(castlingRights).size !== castlingRights.length) {
        throw new Error("FEN contains invalid castling rights.");
    }
    for (const right of castlingRights) {
        const color = right === right.toUpperCase() ? 0 : 1;
        const homeRank = color === 0 ? 1 : 8;
        const rookFile = right.toLowerCase() === "k" ? 8 : 1;
        const kingExists = parsedPieces.some(piece => piece.type === "K" && piece.color === color && piece.file === 5 && piece.rank === homeRank);
        const rookExists = parsedPieces.some(piece => piece.type === "R" && piece.color === color && piece.file === rookFile && piece.rank === homeRank);
        if (!kingExists || !rookExists) throw new Error("FEN castling rights do not match the board.");
    }

    let parsedEnPassantTarget = null;
    if (enPassantField !== "-") {
        const match = enPassantField.match(/^([a-h])([36])$/);
        const expectedRank = whiteToMove ? 6 : 3;
        if (!match || Number(match[2]) !== expectedRank) throw new Error("FEN en-passant target is invalid for the active side.");
        const file = match[1].charCodeAt(0) - 96;
        const rank = Number(match[2]);
        const pawnRank = whiteToMove ? rank - 1 : rank + 1;
        const pawnColor = whiteToMove ? 1 : 0;
        const targetOccupied = parsedPieces.some(piece => piece.file === file && piece.rank === rank);
        const movedPawnExists = parsedPieces.some(piece => piece.type === "P" && piece.color === pawnColor && piece.file === file && piece.rank === pawnRank);
        if (targetOccupied || !movedPawnExists) throw new Error("FEN en-passant target does not match the board.");
        parsedEnPassantTarget = {file, rank};
    }

    if (!/^\d+$/.test(halfmoveField) || !/^\d+$/.test(fullmoveField) || Number(fullmoveField) < 1) {
        throw new Error("FEN move counters must be non-negative integers and fullmove number must be positive.");
    }

    for (const piece of parsedPieces) {
        if (piece.type === "P") {
            piece.fm = piece.color === 0 ? piece.rank === 2 : piece.rank === 7;
        } else if (piece.type === "K") {
            piece.fm = castlingRights.some(right => (right === "K" || right === "Q") === (piece.color === 0));
        } else if (piece.type === "R") {
            if (piece.file === 8 && piece.rank === (piece.color === 0 ? 1 : 8)) {
                piece.fm = castlingRights.includes(piece.color === 0 ? "K" : "k");
            } else if (piece.file === 1 && piece.rank === (piece.color === 0 ? 1 : 8)) {
                piece.fm = castlingRights.includes(piece.color === 0 ? "Q" : "q");
            }
        }
    }

    return {
        pieces: parsedPieces,
        whiteTurn: whiteToMove,
        enPassantTarget: parsedEnPassantTarget,
        halfmoveClock: Number(halfmoveField),
        fullmoveNumber: Number(fullmoveField)
    };
}

function resolveSANMove(token) {
    const normalizeSAN = san => san.replace(/e\.p\.$/i, "").replace(/[+#?!]+$/, "").replace(/0/g, "O");
    const requestedSAN = normalizeSAN(token);
    const color = whiteTurn ? 0 : 1;
    const legalCandidates = [];

    for (const piece of pieces) {
        if (piece.color !== color) continue;

        for (const [file, rank] of genevaConventions(piece, false)) {
            const target = pieces.find(candidate => candidate.file === file && candidate.rank === rank);
            const enPassantCapture = piece.type === "P" && file !== piece.file && !target &&
                enPassantTarget?.file === file && enPassantTarget.rank === rank;
            const isCapture = Boolean(target || enPassantCapture);
            const promotes = piece.type === "P" && rank === (piece.color === 0 ? 8 : 1);
            const promotionChoices = promotes ? ["Q", "R", "B", "N"] : [null];

            for (const promotion of promotionChoices) {
                const castle = piece.type === "K" && Math.abs(file - piece.file) === 2;
                const candidateSAN = addMove({
                    type: piece.type,
                    file,
                    rank,
                    originFile: piece.file,
                    capture: isCapture,
                    promotion: Boolean(promotion),
                    promotionT: promotion,
                    castle,
                    castleK: castle && file > piece.file,
                    disamb: getMoveDisambiguation(piece, file, rank)
                });
                if (normalizeSAN(candidateSAN) === requestedSAN) {
                    legalCandidates.push({piece, file, rank, promotion, enPassantCapture, isCapture});
                }
            }
        }
    }

    if (legalCandidates.length !== 1) {
        throw new Error(legalCandidates.length === 0
            ? `No legal move matches ${token}.`
            : `Move ${token} is ambiguous.`);
    }
    return legalCandidates[0];
}

function applyImportedMove(move) {
    const movingPiece = move.piece;
    const originalFile = movingPiece.file;
    const originalRank = movingPiece.rank;
    const target = pieces.find(piece => piece.file === move.file && piece.rank === move.rank);

    if (target) pieces.splice(pieces.indexOf(target), 1);
    else if (move.enPassantCapture) {
        const capturedPawn = pieces.find(piece => piece.type === "P" && piece.color !== movingPiece.color && piece.file === move.file && piece.rank === originalRank);
        if (!capturedPawn) throw new Error("Invalid en-passant capture in PGN.");
        pieces.splice(pieces.indexOf(capturedPawn), 1);
    }

    if (movingPiece.type === "K" && Math.abs(move.file - originalFile) === 2) {
        const rookFrom = move.file > originalFile ? 8 : 1;
        const rookTo = move.file > originalFile ? move.file - 1 : move.file + 1;
        const rook = pieces.find(piece => piece.type === "R" && piece.color === movingPiece.color && piece.file === rookFrom && piece.rank === originalRank);
        if (!rook) throw new Error("Castling move in PGN has no rook.");
        rook.file = rookTo;
        rook.fm = false;
    }

    const isPawnMove = movingPiece.type === "P";
    enPassantTarget = isPawnMove && Math.abs(move.rank - originalRank) === 2
        ? {file: move.file, rank: (move.rank + originalRank) / 2}
        : null;
    halfmoveClock = isPawnMove || move.isCapture ? 0 : halfmoveClock + 1;
    movingPiece.file = move.file;
    movingPiece.rank = move.rank;
    movingPiece.fm = false;
    if (move.promotion) movingPiece.type = move.promotion;
    if (movingPiece.color === 1) fullmoveNumber++;
    whiteTurn = movingPiece.color === 1;
}

function parsePGN(pgnText) {
    const headers = {};
    const headerPattern = /^\s*\[([A-Za-z][A-Za-z0-9_]*)\s+"((?:\\.|[^"\\])*)"\]\s*$/gm;
    let movetext = pgnText.replace(/^\uFEFF/, "").replace(headerPattern, (tag, name, value) => {
        headers[name] = value.replace(/\\(["\\])/g, "$1");
        return " ";
    });

    let cleanedMovetext = "";
    let inBraceComment = false;
    let inLineComment = false;
    let variationDepth = 0;
    for (const character of movetext) {
        if (inLineComment) {
            if (character === "\n") inLineComment = false;
            continue;
        }
        if (inBraceComment) {
            if (character === "}") inBraceComment = false;
            continue;
        }
        if (character === ";") {
            inLineComment = true;
        } else if (character === "{") {
            inBraceComment = true;
        } else if (character === "(") {
            variationDepth++;
        } else if (character === ")") {
            if (variationDepth === 0) throw new Error("PGN has an unmatched variation close.");
            variationDepth--;
        } else if (variationDepth === 0) {
            cleanedMovetext += character;
        }
    }
    if (inBraceComment || variationDepth !== 0) throw new Error("PGN contains an unclosed comment or variation.");

    const moveTokens = [];
    let movetextResult = null;
    for (const rawToken of cleanedMovetext.trim().split(/\s+/)) {
        let token = rawToken.replace(/^\d+\.(?:\.\.)?/, "");
        if (!token || /^\$\d+$/.test(token) || token.toLowerCase() === "e.p.") continue;
        token = token.replace(/\$\d+$/, "");
        if (token === "1-0" || token === "0-1" || token === "1/2-1/2" || token === "*") {
            if (movetextResult) throw new Error("PGN contains moves after its result marker.");
            movetextResult = token;
        } else {
            if (movetextResult) throw new Error("PGN contains moves after its result marker.");
            moveTokens.push(token);
        }
    }

    const headerResult = headers.Result;
    if (headerResult && !["1-0", "0-1", "1/2-1/2", "*"].includes(headerResult)) {
        throw new Error("PGN Result tag is invalid.");
    }
    if (headerResult && movetextResult && headerResult !== movetextResult) {
        throw new Error("PGN Result tag does not match the movetext result.");
    }

    const startingFEN = headers.FEN ? headers.FEN.trim().split(/\s+/).join(" ") : null;
    if (headers.SetUp === "1" && !startingFEN) throw new Error("PGN SetUp tag requires a FEN tag.");
    const initialPosition = parseFEN(startingFEN ?? "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    const previousState = {pieces, whiteTurn, enPassantTarget, halfmoveClock, fullmoveNumber, positionCounts};
    const positions = [];
    const result = movetextResult ?? headerResult ?? "*";

    try {
        pieces = initialPosition.pieces;
        whiteTurn = initialPosition.whiteTurn;
        enPassantTarget = initialPosition.enPassantTarget;
        halfmoveClock = initialPosition.halfmoveClock;
        fullmoveNumber = initialPosition.fullmoveNumber;
        positionCounts = new Map();

        const savePosition = () => {
            const key = positionKey();
            positionCounts.set(key, (positionCounts.get(key) ?? 0) + 1);
            positions.push({
                pieces: pieces.map(piece => ({type: piece.type, color: piece.color, file: piece.file, rank: piece.rank, fm: piece.fm, ep: piece.ep})),
                whiteTurn,
                enPassantTarget: enPassantTarget ? {...enPassantTarget} : null,
                halfmoveClock,
                fullmoveNumber,
                positionCounts: [...positionCounts.entries()]
            });
        };

        savePosition();
        for (const token of moveTokens) {
            const move = resolveSANMove(token);
            applyImportedMove(move);
            savePosition();
        }
    } finally {
        pieces = previousState.pieces;
        whiteTurn = previousState.whiteTurn;
        enPassantTarget = previousState.enPassantTarget;
        halfmoveClock = previousState.halfmoveClock;
        fullmoveNumber = previousState.fullmoveNumber;
        positionCounts = previousState.positionCounts;
    }

    return {headers, moves: moveTokens, positions, result, startingFEN};
}

function installImportedGame(imported) {
    stopChessClock();
    piecesCanvas.removeEventListener("mousedown", mouseDownEvent);
    piecesCanvas.removeEventListener("mousemove", mouseMoveEvent);
    piecesCanvas.removeEventListener("mouseup", mouseUpEvent);
    resetChessClock();

    gameStartFEN = imported.startingFEN;
    gameStartWhiteTurn = imported.positions[0].whiteTurn;
    gameStartFullmoveNumber = imported.positions[0].fullmoveNumber;
    moveList = [];
    gameState = 1;
    resultLabel.textContent = "Ongoing Game";
    start.disabled = true;

    const installPosition = position => {
        pieces = position.pieces.map(piece => new Piece(piece.type, piece.color, piece.file, piece.rank, piece.fm, piece.ep));
        whiteTurn = position.whiteTurn;
        enPassantTarget = position.enPassantTarget ? {...position.enPassantTarget} : null;
        halfmoveClock = position.halfmoveClock;
        fullmoveNumber = position.fullmoveNumber;
        positionCounts = new Map(position.positionCounts ?? []);
        turnLabel.textContent = whiteTurn ? "White to move" : "Black to move";
        activeClockColor = whiteTurn ? 0 : 1;
    };

    installPosition(imported.positions[0]);
    if (!imported.positions[0].positionCounts) recordPosition();
    document.getElementById("ulPlaceholder").hidden = true;
    dragState.selected = null;
    dragState.piece = null;
    dragState.origin = null;
    dragState.clickMove = false;
    clearMovePreview();
    initializeMoveHistory();

    for (let index = 0; index < imported.moves.length; index++) {
        installPosition(imported.positions[index + 1]);
        recordCompletedMove(imported.moves[index]);
    }

    if (imported.result !== "*") {
        gameState = 0;
        resultLabel.textContent = imported.result === "1-0"
            ? "White won by imported PGN result."
            : imported.result === "0-1"
                ? "Black won by imported PGN result."
                : "Draw by imported PGN result.";
        activeClockColor = null;
    }
    start.disabled = gameState === 1;
    claimDraw.disabled = gameState !== 1 || ((positionCounts.get(positionKey()) ?? 0) < 3 && halfmoveClock < 100);
    const currentSnapshot = boardHistory[historyCursor];
    currentSnapshot.gameState = gameState;
    currentSnapshot.resultText = resultLabel.textContent;
    currentSnapshot.activeClockColor = activeClockColor;

    updateMaterialAdvantage();
    drawManualCheckerboard();
    drawPieces(dragState);
    if (gameState === 1) {
        startChessClock(whiteTurn ? 0 : 1);
        piecesCanvas.addEventListener("mousedown", mouseDownEvent);
        piecesCanvas.addEventListener("mousemove", mouseMoveEvent);
        piecesCanvas.addEventListener("mouseup", mouseUpEvent);
    }
}

async function importPGN() {
    const pgnText = await textDisplay(true, "", "Import PGN");
    if (!pgnText.trim()) return;

    try {
        const imported = parsePGN(pgnText);
        installImportedGame(imported);
    } catch (error) {
        void textDisplay(false, error.message, "PGN Import Error", false);
    }
}
async function importFEN() {
    const fenText = await textDisplay(true, "", "Import FEN");
    if (!fenText.trim()) return;

    try {
        const position = parseFEN(fenText);
        const normalizedFEN = fenText.trim().split(/\s+/).join(" ");
        installImportedGame({startingFEN: normalizedFEN, positions: [position], moves: [], result: "*"});
    } catch (error) {
        void textDisplay(false, error.message, "FEN Import Error", false);
    }
}

document.getElementById("expgn").addEventListener("click", () => {
    void textDisplay(false, exportPGN(), "Export PGN");
});
document.getElementById("exfen").addEventListener("click", () => {
    void textDisplay(false, exportFEN(), "Export FEN");
});
document.getElementById("impgn").addEventListener("click", () => {
    void importPGN();
});
document.getElementById("imfen").addEventListener("click", () => {
    void importFEN();
});

await loadUserSettings();
await textDisplay(false, "Hello! This is my chess project. I made it solely with HTML, CSS and Javascript. It includes time controls, move history, importing/exporting PGN and FEN, and more! Check out my github to see some other things I made.\n\ngithub.com/adoolaTurayk\n\nAlso a very cool variant is coming soon", "Welcome", false)
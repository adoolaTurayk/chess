class Piece {
    constructor(type, color, file, rank, fm=true, ep=false){
        this.type = type;
        this.color = color;
        this.file = file;
        this.rank = rank;
        this.fm = fm;
        this.ep = ep;
    }
}

let pieces = [];
let moveList = [];
let boardHistory = [];
let pieceTypeArray = ['K', 'Q', 'R', 'B', 'N', 'P'];

const arraysEqual = (a, b) =>
    a.length === b.length && a.every((val, index) => val === b[index]);

const resultLabel = document.getElementById("result");
const turnLabel = document.getElementById("turn");
const start = document.getElementById("start");
const reset = document.getElementById("reset");
const reverse = document.getElementById("reverse");
const rotateWithTurn = document.getElementById("rotateWithTurn");
const claimDraw = document.getElementById("claimDraw");
const undo = document.getElementById("undo");
const redo = document.getElementById("redo");
const moveHistoryElement = document.getElementById("moveHistory");
const blackMaterialAdvantage = document.getElementById("blackMaterialAdvantage");
const whiteMaterialAdvantage = document.getElementById("whiteMaterialAdvantage");
const timerSelect = document.getElementById("timerSelect");
const blackClock = document.getElementById("blackClock");
const whiteClock = document.getElementById("whiteClock");
const promotionDiv = document.getElementById("promotion");
const promotionDrop = document.getElementById("promotionSelect");
const promoteBtn = document.getElementById("promoteBtn");

const boardCanvas = document.getElementById('boardCanvas');
const boardCtx = boardCanvas.getContext('2d');
const piecesCanvas = document.getElementById('piecesCanvas');
const piecesCtx = piecesCanvas.getContext('2d');
const previewCanvas = document.getElementById('previewCanvas');
const previewCtx = previewCanvas.getContext('2d');
const pieceImageCache = {};
const sfxCache = {};
const tileSize = piecesCanvas.width / 8;

function playSfx(name) {
    if (!userSettings.sfxEnabled) return;
    const sound = sfxCache[name];
    if (sound) sound.play();
}

let whiteTurn = true;
let gameState = 0; // 0 = Stopped 1 = Ongoing
let gameType = "Rapid";
let enPassantTarget = null;
let boardReversed = false;
let fullmoveNumber = 1;
let gameStartFEN = null;
let gameStartWhiteTurn = true;
let gameStartFullmoveNumber = 1;
let userSettings = {
    movePreviewEnabled: false,
    premovesEnabled: true,
    multiplePremovesEnabled: true,
    syncBoardOrientationToTurn: true,
    sfxEnabled: true
};
let halfmoveClock = 0;
let positionCounts = new Map();
let historyCursor = 0;
let clockInitialSeconds = 600;
let clockIncrementSeconds = 0;
let clockRemaining = [600, 600];
let activeClockColor = null;
let clockIntervalId = null;
let clockLastTick = 0;

const dragState = {
    piece: null,
    selected: null,
    origin: null,
    clickMove: false,
    mouseX: 0,
    mouseY: 0,
    offsetX: 0,
    offsetY: 0
};
let promote = false;
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
    let gamePGN = "";



    return gamePGN;
}
function exportFEN() {
    let gameFEN = "";
    let spaceIncrement = 0;

    
}

function importPGN() {

}
function importFEN() {

}

await textDisplay(false, "Hello! This is my chess project. I made it solely with HTML, CSS and Javascript. It includes time controls, move history, importing/exporting PGN and FEN, and more! Check out my github to see some other things I made.\n\ngithub.com/adoolaTurayk\n\nAlso a very cool variant is coming soon", "Welcome", false)
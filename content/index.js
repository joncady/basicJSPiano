const synth = new Tone.Synth().toMaster();
const partner = new Tone.Synth().toMaster();
const polySynth = new Tone.PolySynth(7, Tone.Synth).toMaster();
const notes = ["C", "C#", "D", "Eb", "E", "N/A", "F", "F#", "G", "Ab", "A", "Bb", "B", "N/A",]
// in progress
const keyCodes = {
    "90": "C4",
    "88": "C#4",
    "67": "D4",
    "86": "D#4",
    "66": "E4",
    "78": "F4",
    "77": "F#4",
    "65": "G4"
};
let keysDownMap = {};
let octaves = 5;
let majorChordIndexes = [0, 4, 8];
let started = false;
let recordNotes = [];
let time = 0;
let timer;
let timeEl;
let startTime;
let importedFile;
let eventFired = false;
let gamepadLoop;

const ID = '_' + Math.random().toString(36).substr(2, 9);

let socket;

try {
    socket = io();
} catch (err) {
    console.log(err);
}

if (socket) {
    socket.on("keydown", (msg) => {
        if (msg.sender !== ID) {
            partner.triggerAttack(msg.note);
        }
    });
    socket.on("keyup", (msg) => {
        if (msg.sender !== ID) {
            partner.triggerRelease();
        }
    });
}


window.addEventListener("gamepadconnected", function(e) {
    let gpIndex = e.gamepad.index;
    gamepadLoop = setInterval(() => gamepadPlay(navigator.getGamepads()[gpIndex]), 10);
});

let lastNoteL;
let lastNoteR;
let gpNotes = {
    "L": {
        "0,1": "C",
        "-1,0": "D",
        "0,-1": "E",
        "1,0": "F"
    },
    "R": {
        "0,1": "G",
        "-1,0": "A",
        "0,-1": "B",
        "1,0": "C"
    }
};

function gamepadPlay(gp) {
    let buttons = gp.buttons;
    let [lX, lY, rX, rY] = gp.axes.map(Math.round);
    let combinedL = String(lX + "," + lY);
    let combinedR = String(rX + "," + rY);
    let noteToPlayL = gpNotes.L[combinedL];
    let noteToPlayR = gpNotes.R[combinedR];
    if (noteToPlayL && buttons[6].pressed) {
        noteToPlayL += "b";
    } else if (noteToPlayL && buttons[7].pressed) {
        noteToPlayL += "#";
    }
    if (noteToPlayR && buttons[6].pressed) {
        noteToPlayR += "b";
    } else if (noteToPlayR && buttons[7].pressed) {
        noteToPlayR += "#";
    }
    if (combinedL == "0,0" && lastNoteL) {
        lastNoteL = null;
        synth.triggerRelease();
    } else if (combinedR == "0,0" && lastNoteR) {
        lastNoteR = null;
        synth.triggerRelease();
    }
    if (noteToPlayL) {
        if (noteToPlayL != lastNoteL) {
            synth.triggerRelease();
            lastNoteL = noteToPlayL;
            lastNoteR = null;
            synth.triggerAttack(noteToPlayL + "4");
        }
    } else if (noteToPlayR) {
        if (noteToPlayR != lastNoteR) {
            synth.triggerRelease();
            lastNoteR = noteToPlayR;
            lastNoteL = null;
            synth.triggerAttackRelease(noteToPlayR + (noteToPlayR === "C" ? "5": "4"));
        }
    }

}

document.onkeydown = function (e) {
    if (!keysDownMap[e.which]) {
        let note = keyCodes[e.which];
        keysDownMap[e.which] = true;
        if (note) {
            polySynth.triggerAttack([note]);
        }
    }
}

document.onkeyup = function (e) {
    let note = keyCodes[e.which];
    keysDownMap[e.which] = false;
    polySynth.triggerRelease([note]);
}

function readyListeners() {
    document.querySelector("#import").addEventListener("change", (e) => {
        importedFile = null;
        let reader = new FileReader();
        reader.onload = onReaderLoad;
        reader.readAsText(event.target.files[0]);
    });
    document.querySelector("#play").addEventListener("click", () => {
        if (importedFile) {
            playRecordedSong(importedFile);
        } else {
            alert("No song imported!");
        }
    });
    document.querySelector("#record").addEventListener("click", recordSong);
    document.querySelector("#stop").addEventListener("click", () => {
        started = false;
        clearInterval(timer);
    });
    document.querySelector("#save-button").addEventListener("click", () => {
        if (recordNotes) {
            let dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(recordNotes));
            let dlAnchorElem = document.getElementById('save');
            dlAnchorElem.setAttribute("href", dataStr);
            dlAnchorElem.setAttribute("download", "song.json");
            dlAnchorElem.click();
        } else {
            alert("No song recorded!");
        }
    });
    timerEl = document.getElementById("timer");
}

function createKeys() {
    let keys = document.getElementById("keys");
    for (let octave = 2; octave <= octaves; octave++) {
        for (let i = 0; i < notes.length; i++) {
            let note = notes[i];
            if (note !== "N/A") {
                let key = document.createElement("div");
                if (note.length > 1) {
                    key.classList.add("black-key");
                } else {
                    key.classList.add("white-key");
                }
                key.addEventListener("mousedown", () => playKey(note, octave, true));
                key.addEventListener("mouseup", () => playKey(note, octave, false));
                key.addEventListener("mouseout", () => synth.triggerRelease());

                // key.addEventListener("mousedown", () => playChord(i, octave, false));
                // key.addEventListener("mouseup", () => playChord(i, octave, true));
                keys.appendChild(key);
            }
        }
    }
}

function onReaderLoad(event) {
    let obj = JSON.parse(event.target.result);
    importedFile = obj;
}

// only one note at a time
function playKey(key, octave, play) {
    if (play) {
        if (started) {
            startTime = time;
        }
        if (socket) {
            socket.emit('keydown', {
                note: key + octave,
                sender: ID
            });
        }
        synth.triggerAttack(key + octave);
    } else {
        if (started) {
            recordNotes.push({
                note: key + octave,
                start: startTime,
                duration: time - startTime
            });
            startTime = null;
        }
        if (socket) {
            socket.emit('keyup', {
                note: key + octave,
                sender: ID
            });
        }
        synth.triggerRelease();
    }
}

function playRecordedSong(song) {
    let arr = JSON.parse(song);
    playRecordedSong(arr);
}

function recordSong() {
    recordNotes = [];
    time = 0;
    started = true;
    timer = setInterval(() => {
        time++;
        // I don't think the timer is correctly registering seconds though...
        timerEl.textContent = String(time / 100);
    }, 10);
}

function playRecordedSong(song) {
    let interval;
    let inArray = 0;
    let beat = 0;
    interval = setInterval(() => {
        if (inArray == song.length) {
            console.log("stopped")
            clearInterval(interval);
        } else {
            let note = song[inArray];
            if (note.start === beat) {
                playNote(note);
                inArray++;
            }
        }
        beat++;
    }, 10);
}

function playSong(song) {
    let interval;
    let inArray = 0;
    let beat = 0;
    interval = setInterval(() => {
        if (inArray == song.length) {
            console.log("stopped")
            clearInterval(interval);
        } else {
            let note = song[inArray];
            if (note.start === beat) {
                playNote(song[inArray]);
                inArray++;
            }
        }
        beat++;
    }, (song.bpm / 60) * 1000);
}

function playNote(note) {
    synth.triggerAttackRelease(note.note, note.duration / 100);
}

// doesn't work yet
function playChord(noteIndex, octave, stop) {
    let thirdIndex = noteIndex + majorChordIndexes[1];
    let fifthIndex = noteIndex + majorChordIndexes[2];
    if (thirdIndex > notes.length) {
        thirdIndex = thirdIndex % notes.length;
    }
    if (notes[thirdIndex] === "N/A") thirdIndex++;
    if (fifthIndex + majorChordIndexes[1] > notes.length) {
        fifthIndex = fifthIndex % notes.length;
    }
    if (notes[fifthIndex] === "N/A") fifthIndex++;
    let toPlay = [notes[noteIndex] + octave, notes[thirdIndex] + octave, notes[fifthIndex] + octave];
    if (stop) {
        polySynth.triggerRelease(toPlay);
    } else {
        polySynth.triggerAttack(toPlay)
    }
}

readyListeners();
createKeys();
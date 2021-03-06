define(["require", "exports", "./app", "./base", "./board", "./layer", "./log", "./util", "./variation_tree", "./winrate_graph"], function (require, exports, app_1, base_1, board_1, lyr, log_1, util_1, variation_tree_1, winrate_graph_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class ExploreBoard extends board_1.ClickableBoard {
        constructor(parentElemId, position, gtp) {
            super(parentElemId, position, []);
            this.gtp = gtp;
            this._showSearch = true;
            this._highlightedNextMove = null;
            this.searchLayer = new lyr.Search();
            this.variationLayer = new lyr.Variation('pv');
            this.addLayers([
                new lyr.Label(),
                new lyr.BoardStones(),
                this.searchLayer,
                this.variationLayer,
                new lyr.Annotations()
            ]);
            this.variationLayer.show = false;
            this.enabled = true;
            this.ctx.canvas.addEventListener('mousemove', (e) => {
                if (this.showSearch) {
                    let p = this.canvasToBoard(e.offsetX, e.offsetY, 0.45);
                    if (p != null) {
                        if (this.getStone(p) != base_1.Color.Empty || !this.searchLayer.hasVariation(p)) {
                            p = null;
                        }
                    }
                    this.showVariation(p);
                }
            });
            this.ctx.canvas.addEventListener('mouseleave', () => {
                if (this.showSearch) {
                    this.showVariation(null);
                }
            });
            this.onClick((p) => {
                if (this.variationLayer.showVariation != 'pv') {
                    this.gtp.send('variation');
                }
                this.variationLayer.showVariation = 'pv';
                this.variationLayer.clear();
                this.variationLayer.show = false;
                this.searchLayer.clear();
                this.searchLayer.show = true;
            });
        }
        get showSearch() {
            return this._showSearch;
        }
        set showSearch(x) {
            if (x != this._showSearch) {
                this._showSearch = x;
                if (x) {
                    this.variationLayer.show = false;
                    this.searchLayer.show = true;
                }
                else {
                    this.variationLayer.show = false;
                    this.searchLayer.show = false;
                }
                this.draw();
            }
        }
        get highlightedNextMove() {
            return this._highlightedNextMove;
        }
        set highlightedNextMove(x) {
            if (x != this._highlightedNextMove) {
                this._highlightedNextMove = x;
                this.draw();
            }
        }
        get variation() {
            return this.variationLayer.variation;
        }
        setPosition(position) {
            if (position != this.position) {
                this.showVariation(null);
                super.setPosition(position);
            }
        }
        drawImpl() {
            super.drawImpl();
            if (this.showSearch) {
                this.drawNextMoves();
            }
        }
        drawNextMoves() {
            let sr = this.stoneRadius;
            let pr = util_1.pixelRatio();
            let circum = 2 * Math.PI * sr;
            let numDashes = 9 * Math.round(circum / 9);
            let dashLen = 4 * circum / numDashes;
            let spaceLen = 5 * circum / numDashes;
            let colors;
            if (this.position.toPlay == base_1.Color.Black) {
                colors = ['#000', '#fff'];
            }
            else {
                colors = ['#fff', '#000'];
            }
            let ctx = this.ctx;
            let lineDash = [dashLen, spaceLen];
            ctx.lineCap = 'round';
            ctx.setLineDash(lineDash);
            for (let pass = 0; pass < 2; ++pass) {
                ctx.strokeStyle = colors[pass];
                ctx.lineWidth = (3 - pass * 2) * pr;
                for (let child of this.position.children) {
                    let move = child.lastMove;
                    if (move == null || move == 'pass' || move == 'resign') {
                        continue;
                    }
                    if (child.lastMove == this.highlightedNextMove) {
                        ctx.setLineDash([]);
                    }
                    let c = this.boardToCanvas(move.row, move.col);
                    ctx.beginPath();
                    ctx.moveTo(c.x + 0.5 + sr, c.y + 0.5);
                    ctx.arc(c.x + 0.5, c.y + 0.5, sr, 0, 2 * Math.PI);
                    ctx.stroke();
                    if (child.lastMove == this.highlightedNextMove) {
                        ctx.setLineDash(lineDash);
                    }
                }
            }
            ctx.setLineDash([]);
        }
        showVariation(p) {
            let moveStr;
            if (p == null) {
                moveStr = 'pv';
            }
            else {
                moveStr = base_1.toKgs(p);
            }
            if (moveStr == this.variationLayer.showVariation) {
                return;
            }
            this.variationLayer.showVariation = moveStr;
            this.variationLayer.clear();
            this.variationLayer.show = p != null;
            this.searchLayer.show = p == null;
            if (p != null) {
                this.gtp.send(`variation ${moveStr}`);
            }
            else {
                this.gtp.send('variation');
            }
        }
    }
    class ExploreApp extends app_1.App {
        constructor() {
            super();
            this.winrateGraph = new winrate_graph_1.WinrateGraph('winrate-graph');
            this.variationTree = new variation_tree_1.VariationTree('tree');
            this.log = new log_1.Log('log', 'console');
            this.showSearch = true;
            this.showConsole = false;
            this.moveElem = util_1.getElement('move');
            this.commentElem = util_1.getElement('comment');
            this.searchElem = util_1.getElement('toggle-search');
            this.blackCapturesElem = util_1.getElement('b-caps');
            this.whiteCapturesElem = util_1.getElement('w-caps');
            this.readsElem = util_1.getElement('reads');
            this.connect().then(() => {
                this.board = new ExploreBoard('main-board', this.rootPosition, this.gtp);
                this.board.onClick((p) => {
                    this.playMove(this.activePosition.toPlay, p);
                });
                this.initEventListeners();
                this.log.onConsoleCmd((cmd) => {
                    this.gtp.send(cmd).then(() => { this.log.scroll(); });
                });
                this.gtp.onText((line) => {
                    this.log.log(line, 'log-cmd');
                    if (this.showConsole) {
                        this.log.scroll();
                    }
                });
                this.newGame();
                this.variationTree.onClick((position) => {
                    if (position != this.activePosition) {
                        this.selectPosition(position);
                    }
                });
                this.variationTree.onHover((position) => {
                    if (position != null) {
                        this.board.highlightedNextMove = position.lastMove;
                    }
                    else {
                        this.board.highlightedNextMove = null;
                    }
                });
                this.gtp.onData('mg-ponder', (result) => {
                    if (result.trim().toLowerCase() == 'done') {
                        this.gtp.send('ponder time 10');
                    }
                });
                this.gtp.send('ponder time 10');
            });
        }
        initEventListeners() {
            window.addEventListener('keydown', (e) => {
                if (e.key == 'Escape') {
                    this.showConsole = !this.showConsole;
                    let containerElem = util_1.getElement('log-container');
                    containerElem.style.top = this.showConsole ? '0' : '-40vh';
                    if (this.showConsole) {
                        this.log.focus();
                        this.log.scroll();
                    }
                    else {
                        this.log.blur();
                    }
                    e.preventDefault();
                    return false;
                }
                for (let elem of [this.log.consoleElem, this.moveElem]) {
                    if (document.activeElement == elem) {
                        return;
                    }
                }
                if (e.key >= '0' && e.key <= '9' && this.board.variation != null) {
                    let move = e.key.charCodeAt(0) - '0'.charCodeAt(0);
                    if (move == 0) {
                        move = 10;
                    }
                    if (move <= this.board.variation.length) {
                        let color = this.board.position.toPlay;
                        for (let i = 0; i < move; ++i) {
                            this.playMove(color, this.board.variation[i]);
                            color = base_1.otherColor(color);
                        }
                    }
                }
                switch (e.key) {
                    case ' ':
                        this.toggleSearch();
                        break;
                    case 'ArrowUp':
                    case 'ArrowLeft':
                        this.goBack(1);
                        break;
                    case 'ArrowRight':
                    case 'ArrowDown':
                        this.goForward(1);
                        break;
                    case 'PageUp':
                        this.goBack(10);
                        break;
                    case 'PageDown':
                        this.goForward(10);
                        break;
                    case 'Home':
                        this.goBack(Infinity);
                        break;
                    case 'End':
                        this.goForward(Infinity);
                        break;
                }
            });
            window.addEventListener('wheel', (e) => {
                if (this.showConsole || e.target == this.commentElem) {
                    return;
                }
                let delta;
                if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
                    delta = e.deltaX;
                }
                else {
                    delta = e.deltaY;
                }
                if (delta < 0) {
                    this.goBack(1);
                }
                else if (delta > 0) {
                    this.goForward(1);
                }
            });
            this.searchElem.addEventListener('click', () => { this.toggleSearch(); });
            let clearElem = util_1.getElement('clear-board');
            clearElem.addEventListener('click', () => { this.newGame(); });
            let loadSgfElem = util_1.getElement('load-sgf-input');
            loadSgfElem.addEventListener('change', () => {
                let files = Array.prototype.slice.call(loadSgfElem.files);
                if (files.length != 1) {
                    return;
                }
                let reader = new FileReader();
                reader.onload = () => {
                    this.newGame();
                    let sgf = reader.result.replace(/\n/g, '\\n');
                    this.board.enabled = false;
                    this.board.showSearch = false;
                    this.gtp.send(`playsgf ${sgf}`).catch((error) => {
                        window.alert(error);
                    }).finally(() => {
                        this.board.enabled = true;
                        this.board.showSearch = this.showSearch;
                    });
                };
                reader.readAsText(files[0]);
                loadSgfElem.value = "";
            });
            let mainLineElem = util_1.getElement('main-line');
            mainLineElem.addEventListener('click', () => {
                let position = this.activePosition;
                while (position != this.rootPosition &&
                    !position.isMainLine && position.parent != null) {
                    position = position.parent;
                }
                if (position != this.activePosition) {
                    this.selectPosition(position);
                }
            });
            this.moveElem.addEventListener('keypress', (e) => {
                if (e.key < '0' || e.key > '9') {
                    e.preventDefault();
                    return false;
                }
            });
            this.moveElem.addEventListener('blur', () => {
                this.moveElem.innerText = this.activePosition.moveNum.toString();
            });
            this.moveElem.addEventListener('input', () => {
                let moveNum = parseInt(this.moveElem.innerText);
                if (isNaN(moveNum)) {
                    return;
                }
                let position = this.rootPosition;
                while (position.moveNum != moveNum && position.children.length > 0) {
                    position = position.children[0];
                }
                if (position.moveNum == moveNum) {
                    if (position != this.activePosition) {
                        this.selectPosition(position);
                    }
                }
            });
        }
        goBack(n) {
            let position = this.activePosition;
            for (let i = 0; i < n && position.parent != null; ++i) {
                position = position.parent;
            }
            this.selectPosition(position);
        }
        goForward(n) {
            let position = this.activePosition;
            for (let i = 0; i < n && position.children.length > 0; ++i) {
                position = position.children[0];
            }
            this.selectPosition(position);
        }
        selectPosition(position) {
            this.activePosition = position;
            this.board.setPosition(position);
            this.winrateGraph.setActive(position);
            this.variationTree.setActive(position);
            this.commentElem.innerText = position.comment;
            this.blackCapturesElem.innerText = this.activePosition.captures[0].toString();
            this.whiteCapturesElem.innerText = this.activePosition.captures[1].toString();
            this.readsElem.innerText = this.formatNumReads(position.n);
            let moveNumStr = position.moveNum.toString();
            if (this.moveElem.innerText != moveNumStr) {
                this.moveElem.innerText = moveNumStr;
                if (document.activeElement == this.moveElem) {
                    this.moveElem.blur();
                }
            }
            this.gtp.sendOne(`select_position ${position.id}`).catch(() => { });
        }
        newGame() {
            super.newGame();
            this.variationTree.newGame(this.rootPosition);
            this.winrateGraph.newGame(this.rootPosition);
            this.board.newGame(this.rootPosition);
            this.log.clear();
        }
        onPositionUpdate(position, update) {
            this.winrateGraph.update(position);
            if (position != this.activePosition) {
                return;
            }
            this.board.update(update);
            this.readsElem.innerText = this.formatNumReads(position.n);
        }
        formatNumReads(numReads) {
            if (numReads < 1000) {
                return numReads.toString();
            }
            numReads /= 1000;
            let places = Math.max(0, 2 - Math.floor(Math.log10(numReads)));
            return numReads.toFixed(places) + 'k';
        }
        onNewPosition(position) {
            if (position.parent != null) {
                this.variationTree.addChild(position.parent, position);
            }
            this.selectPosition(position);
        }
        playMove(color, move) {
            let colorStr = color == base_1.Color.Black ? 'b' : 'w';
            let moveStr = base_1.toKgs(move);
            this.board.enabled = false;
            this.gtp.send(`play ${colorStr} ${moveStr}`).finally(() => {
                this.board.enabled = true;
            });
        }
        onGameOver() {
            this.gtp.send('final_score').then((result) => {
                this.log.log(util_1.toPrettyResult(result));
                this.log.scroll();
            });
        }
        toggleSearch() {
            this.showSearch = !this.showSearch;
            this.board.showSearch = this.showSearch;
            if (this.showSearch) {
                this.searchElem.innerText = 'Hide search';
            }
            else {
                this.searchElem.innerText = 'Show search';
            }
        }
    }
    new ExploreApp();
});
//# sourceMappingURL=study.js.map
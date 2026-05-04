import { Camera } from './camera';
import { canvasHeight, canvasWidth, initialZoom, Skills, Themes, zoomThreshold } from './data/constants';
import { type StageDef, stages } from './data/maps';
import { FastForwader } from './fastForwader';
import type { GameObject } from './gameObject';
import type { IPhysics } from './IPhysics';
import { Marble } from './marble';
import { Minimap } from './minimap';
import options from './options';
import { ParticleManager } from './particleManager';
import { Box2dPhysics } from './physics-box2d';
import { RankRenderer } from './rankRenderer';
import { RouletteRenderer } from './rouletteRenderer';
import { SkillEffect } from './skillEffect';
import type { ColorTheme } from './types/ColorTheme';
import type { MouseEventHandlerName, MouseEventName } from './types/mouseEvents.type';
import type { UIObject } from './UIObject';
import { bound } from './utils/bound.decorator';
import { globalPRNG } from './utils/prng';
import { parseName } from './utils/utils';
import { VideoRecorder } from './utils/videoRecorder';

export class Roulette extends EventTarget {
  private _marbles: Marble[] = [];

  private _lastTime: number = 0;
  private _elapsed: number = 0;

  private _updateInterval = 10;
  private _timeScale = 1;
  private _speed = 1;

  private _winners: Marble[] = [];
  private _particleManager = new ParticleManager();
  private _stage: StageDef | null = null;

  protected _camera: Camera = new Camera();
  protected _renderer: RouletteRenderer;

  private _effects: GameObject[] = [];

  private _winnerRank = 0;
  private _totalMarbleCount = 0;
  private _goalDist: number = Infinity;
  private _isRunning: boolean = false;
  private _isSimulating: boolean = false;
  private _seatingMode: boolean = false;
  private _seatingSeed: number | undefined = undefined;
  private _winner: Marble | null = null;
  private _predeterminedOrder: string[] = [];

  private _uiObjects: UIObject[] = [];

  private _autoRecording: boolean = false;
  private _recorder!: VideoRecorder;

  private physics!: IPhysics;

  private _isReady: boolean = false;
  protected fastForwarder!: FastForwader;
  protected _theme: ColorTheme = Themes.dark;

  get isReady() {
    return this._isReady;
  }

  protected createRenderer(): RouletteRenderer {
    return new RouletteRenderer();
  }

  protected createFastForwader(): FastForwader {
    return new FastForwader();
  }

  constructor() {
    super();
    this._renderer = this.createRenderer();
    this._renderer.init().then(() => {
      this._init().then(() => {
        this._isReady = true;
        this._update();
      });
    });
  }

  public getZoom() {
    return initialZoom * this._camera.zoom;
  }

  private addUiObject(obj: UIObject) {
    this._uiObjects.push(obj);
    if (obj.onWheel) {
      this._renderer.canvas.addEventListener('wheel', obj.onWheel);
    }
    if (obj.onMessage) {
      obj.onMessage((msg) => {
        console.log('onMessage', msg);
        this.dispatchEvent(new CustomEvent('message', { detail: msg }));
      });
    }
  }

  @bound
  private _update() {
    if (!this._lastTime) this._lastTime = Date.now();
    const currentTime = Date.now();

    this._elapsed += (currentTime - this._lastTime) * this._speed * this.fastForwarder.speed;
    if (this._elapsed > 100) {
      this._elapsed %= 100;
    }
    this._lastTime = currentTime;

    while (this._elapsed >= this._updateInterval) {
      const interval = (this._updateInterval / 1000) * this._timeScale;
      this.physics.step(interval);
      this._updateMarbles(this._updateInterval);

      if (this._marbles.length > 1) {
        this._marbles.sort((a, b) => b.y - a.y);
      }

      this._particleManager.update(this._updateInterval);
      this._updateEffects(this._updateInterval);
      this._elapsed -= this._updateInterval;
      this._uiObjects.forEach((obj) => obj.update(this._updateInterval));
    }

    if (this._stage) {
      this._camera.update({
        marbles: this._marbles,
        stage: this._stage,
        needToZoom: this._goalDist < zoomThreshold,
        targetIndex: this._winners.length > 0 ? this._winnerRank - this._winners.length : 0,
      });
    }

    this._render();
    window.requestAnimationFrame(this._update);
  }

  private _updateMarbles(deltaTime: number) {
    if (!this._stage) return;

    for (let i = 0; i < this._marbles.length; i++) {
      const marble = this._marbles[i];
      marble.update(deltaTime);
      if (marble.skill === Skills.Impact) {
        this._effects.push(new SkillEffect(marble.x, marble.y));
        this.physics.impact(marble.id);
      }
      if (marble.y > this._stage.goalY) {
        this._winners.push(marble);
        if (this._isRunning && this._winners.length === this._winnerRank + 1) {
          if (!this._isSimulating) {
            this.dispatchEvent(new CustomEvent('goal', { detail: { winner: marble.name } }));
            this._particleManager.shot(this._renderer.width, this._renderer.height);
            if (this._recorder) {
              setTimeout(() => {
                this._recorder.stop();
              }, 1000);
            }
          }
          this._winner = marble;
          this._isRunning = false;
          if (!this._isSimulating && this._seatingMode) {
            const allWinners = this._winners.map((w) => w.name);
            setTimeout(() => {
              this.dispatchEvent(new CustomEvent('seatingComplete', { detail: { winners: allWinners } }));
            }, 2000);
          }
        } else if (
          this._isRunning &&
          this._winnerRank === this._winners.length &&
          this._winnerRank === this._totalMarbleCount - 1
        ) {
          const finalMarble = this._marbles.find((candidate) => candidate !== marble);
          if (!finalMarble) continue;
          if (!this._isSimulating) {
            this.dispatchEvent(
              new CustomEvent('goal', {
                detail: { winner: finalMarble.name },
              })
            );
            this._particleManager.shot(this._renderer.width, this._renderer.height);
            if (this._recorder) {
              setTimeout(() => {
                this._recorder.stop();
              }, 1000);
            }
          }
          this._winner = finalMarble;
          this._isRunning = false;
          if (!this._isSimulating && this._seatingMode) {
            const allWinners = this._winners.map((w) => w.name);
            allWinners.push(finalMarble.name);
            setTimeout(() => {
              this.dispatchEvent(new CustomEvent('seatingComplete', { detail: { winners: allWinners } }));
            }, 2000);
          }
        }
        this.physics.removeMarble(marble.id);
      }
    }

    const targetIndex = this._winnerRank - this._winners.length;
    const topY = this._marbles[targetIndex] ? this._marbles[targetIndex].y : 0;
    this._goalDist = Math.abs(this._stage.zoomY - topY);
    this._timeScale = this._calcTimeScale();

    this._marbles = this._marbles.filter(
      (marble) => !this._winners.includes(marble) && marble.y <= (this._stage?.goalY || 0)
    );
  }

  private _calcTimeScale(): number {
    if (!this._stage) return 1;
    const targetIndex = this._winnerRank - this._winners.length;
    if (this._winners.length < this._winnerRank + 1 && this._goalDist < zoomThreshold) {
      if (
        this._marbles[targetIndex].y > this._stage.zoomY - zoomThreshold * 1.2 &&
        (this._marbles[targetIndex - 1] || this._marbles[targetIndex + 1])
      ) {
        return Math.max(0.2, this._goalDist / zoomThreshold);
      }
    }
    return 1;
  }

  private _updateEffects(deltaTime: number) {
    this._effects.forEach((effect) => effect.update(deltaTime));
    this._effects = this._effects.filter((effect) => !effect.isDestroy);
  }

  private _render() {
    if (!this._stage) return;
    const renderParams = {
      camera: this._camera,
      stage: this._stage,
      entities: this.physics.getEntities(),
      marbles: this._marbles,
      winners: this._winners,
      particleManager: this._particleManager,
      effects: this._effects,
      winnerRank: this._winnerRank,
      winner: this._winner,
      size: { x: this._renderer.width, y: this._renderer.height },
      theme: this._theme,
    };
    this._renderer.render(renderParams, this._uiObjects);
  }

  private async _init() {
    this._recorder = new VideoRecorder(this._renderer.canvas);

    this.physics = new Box2dPhysics();
    await this.physics.init();

    this.addUiObject(new RankRenderer());
    this.attachEvent();
    const minimap = new Minimap();
    minimap.onViewportChange((pos) => {
      if (pos) {
        this._camera.setPosition(pos, false);
        this._camera.lock(true);
      } else {
        this._camera.lock(false);
      }
    });
    this.addUiObject(minimap);
    this.fastForwarder = this.createFastForwader();
    this.addUiObject(this.fastForwarder);
    this._stage = stages[0];
    this._loadMap();
  }

  @bound
  private mouseHandler(eventName: MouseEventName, e: MouseEvent) {
    const handlerName = `on${eventName}` as MouseEventHandlerName;

    const sizeFactor = this._renderer.sizeFactor;
    const pos = { x: e.offsetX * sizeFactor, y: e.offsetY * sizeFactor };
    this._uiObjects.forEach((obj) => {
      if (!obj[handlerName]) return;
      const bounds = obj.getBoundingBox();
      if (!bounds) {
        obj[handlerName]({ ...pos, button: e.button });
      } else if (
        bounds &&
        pos.x >= bounds.x &&
        pos.y >= bounds.y &&
        pos.x <= bounds.x + bounds.w &&
        pos.y <= bounds.y + bounds.h
      ) {
        obj[handlerName]({ x: pos.x - bounds.x, y: pos.y - bounds.y, button: e.button });
      } else {
        obj[handlerName](undefined);
      }
    });
  }

  private attachEvent() {
    const canvas = this._renderer.canvas;
    const onPointerRelease = (e: Event) => {
      this.mouseHandler('MouseUp', e as MouseEvent);
      window.removeEventListener('pointerup', onPointerRelease);
      window.removeEventListener('pointercancel', onPointerRelease);
    };

    canvas.addEventListener('pointerdown', (e: Event) => {
      this.mouseHandler('MouseDown', e as MouseEvent);
      window.addEventListener('pointerup', onPointerRelease);
      window.addEventListener('pointercancel', onPointerRelease);
    });

    ['MouseMove', 'DblClick'].forEach((ev) => {
      // @ts-expect-error
      canvas.addEventListener(ev.toLowerCase().replace('mouse', 'pointer'), this.mouseHandler.bind(this, ev));
    });
    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
  }

  private _loadMap() {
    if (!this._stage) {
      throw new Error('No map has been selected');
    }

    this.physics.createStage(this._stage);
    this._camera.initializePosition();
  }

  public clearMarbles() {
    this.physics.clearMarbles();
    this._winner = null;
    this._winners = [];
    this._marbles = [];
  }

  public start() {
    this._isRunning = true;
    this._winnerRank = options.winningRank;
    if (this._winnerRank >= this._marbles.length) {
      this._winnerRank = this._marbles.length - 1;
    }
    this._elapsed = 0;
    this._lastTime = Date.now();
    this._timeScale = 1;
    this._goalDist = Infinity;
    this._camera.startFollowingMarbles();

    if (this._autoRecording) {
      this._recorder.start().then(() => {
        this.physics.start();
        this._marbles.forEach((marble) => (marble.isActive = true));
      });
    } else {
      this.physics.start();
      this._marbles.forEach((marble) => (marble.isActive = true));
    }
  }

  public setSpeed(value: number) {
    if (value <= 0) {
      throw new Error('Speed multiplier must larger than 0');
    }
    this._speed = value;
  }

  public setTheme(themeName: keyof typeof Themes) {
    this._theme = Themes[themeName];
  }

  public getSpeed() {
    return this._speed;
  }

  public setWinningRank(rank: number) {
    this._winnerRank = rank;
  }

  public setAutoRecording(value: boolean) {
    this._autoRecording = value;
  }

  public setMarbles(names: string[]) {
    this.reset();
    const arr = names.slice();

    let maxWeight = -Infinity;
    let minWeight = Infinity;

    const members = arr
      .map((nameString) => {
        const result = parseName(nameString);
        if (!result) return null;
        const { name, weight, count } = result;
        if (weight > maxWeight) maxWeight = weight;
        if (weight < minWeight) minWeight = weight;
        return { name, weight, count };
      })
      .filter((member) => !!member);

    const gap = maxWeight - minWeight;

    let totalCount = 0;
    members.forEach((member) => {
      if (member) {
        member.weight = 0.1 + (gap ? (member.weight - minWeight) / gap : 0);
        totalCount += member.count;
      }
    });

    const orders = globalPRNG.shuffle(
      Array(totalCount)
        .fill(0)
        .map((_, i) => i)
    );

    members.forEach((member) => {
      if (member) {
        for (let j = 0; j < member.count; j++) {
          const order = orders.pop() || 0;
          this._marbles.push(new Marble(this.physics, order, totalCount, member.name, member.weight));
        }
      }
    });
    this._totalMarbleCount = totalCount;

    // 카메라를 구슬 생성 위치 중앙으로 이동 + 줌인
    if (totalCount > 0) {
      const cols = Math.min(totalCount, 10);
      const rows = Math.ceil(totalCount / 10);
      const lineDelta = -Math.max(0, Math.ceil(rows - 5));
      const centerX = 10.25 + (cols - 1) * 0.3;
      const centerY = (1 + rows) / 2 + lineDelta;

      const spawnWidth = Math.max((cols - 1) * 0.6, 1);
      const spawnHeight = Math.max(rows - 1, 1);
      const margin = 3;
      const viewW = canvasWidth / initialZoom;
      const viewH = canvasHeight / initialZoom;
      const zoom = Math.max(
        1.5,
        Math.min(Math.min(viewW / (spawnWidth + margin * 2), viewH / (spawnHeight + margin * 2)), 3)
      );

      this._camera.initializePosition({ x: centerX, y: centerY }, zoom);
    }
  }

  public reset() {
    this.physics.resetWorld();
    this._isRunning = false;
    this._winner = null;
    this._winners = [];
    this._marbles = [];
    this._loadMap();
    this._timeScale = 1;
    this._goalDist = Infinity;
  }

  public getCount() {
    return this._marbles.length;
  }

  public getMaps() {
    return stages.map((stage, index) => {
      return {
        index,
        title: stage.title,
      };
    });
  }

  public setMap(index: number) {
    if (index < 0 || index > stages.length - 1) {
      throw new Error('Incorrect map number');
    }
    const names = this._marbles.map((marble) => marble.name);
    this._stage = stages[index];
    this.setMarbles(names);
    this._camera.initializePosition();
  }

  public findValidSeed(names: string[], isValid: (winners: string[]) => boolean, maxAttempts: number = 100): number {
    this._isSimulating = true;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const seed = Date.now() + attempt;
      globalPRNG.setSeed(seed);
      this.setMarbles(names);

      this._winners = []; // Reset winners for each attempt
      this._isRunning = true;
      this._winnerRank = this._marbles.length - 1; // get all winners

      this.physics.start();
      this._marbles.forEach((marble) => (marble.isActive = true));

      let emergencyBreak = 0;
      while (this._isRunning && emergencyBreak < 5000000) {
        // Max 5,000,000 steps
        emergencyBreak++;
        const interval = (this._updateInterval / 1000) * this._timeScale;
        this.physics.step(interval);
        this._updateMarbles(this._updateInterval);

        if (this._marbles.length > 1) {
          this._marbles.sort((a, b) => b.y - a.y);
        }
      }

      this.physics.clear(); // Clean up physics world

      // Build full winner list — the last marble (actual "winner") may not be in _winners
      const winnerNames = this._winners.map((w) => w.name);
      if (this._winner && !winnerNames.includes(this._winner.name)) {
        winnerNames.push(this._winner.name);
      }
      if (isValid(winnerNames)) {
        this._isSimulating = false;
        return seed;
      }
    }
    this._isSimulating = false;
    return -1; // Failed to find
  }

  public prepareSeatingMode(seed: number) {
    this._seatingMode = true;
    this._seatingSeed = seed;
    if (typeof window !== 'undefined' && (window as any).options) {
      (window as any).options.useSkills = false;
    }
  }

  public setPredeterminedOrder(order: string[]) {
    this._predeterminedOrder = order;
  }

  public previewSeatingOrder() {
    if (!this._seatingMode || this._marbles.length === 0 || this._predeterminedOrder.length === 0) {
      return;
    }

    const originalNames = this._marbles.map((marble) => marble.name);
    const mappedNames = this._runHeadlessSimulationAndGetMappedNames(originalNames);
    if (mappedNames) {
      this.setMarbles(mappedNames);
    }
  }

  private _getFinishOrderIds(): number[] {
    const finishOrderIds = this._winners.map((winner) => winner.id);
    if (this._winner && !finishOrderIds.includes(this._winner.id)) {
      finishOrderIds.push(this._winner.id);
    }
    return finishOrderIds;
  }

  private _runHeadlessSimulationAndGetMappedNames(originalNames: string[]): string[] | null {
    const seed = this._seatingSeed !== undefined ? this._seatingSeed : Date.now();
    this._isSimulating = true;

    this.reset();
    let maxWeight = -Infinity;
    let minWeight = Infinity;
    const members = originalNames
      .map((nameString, originalIndex) => {
        const result = parseName(nameString);
        if (!result) return null;
        if (result.weight > maxWeight) maxWeight = result.weight;
        if (result.weight < minWeight) minWeight = result.weight;
        return { ...result, originalIndex };
      })
      .filter((m) => !!m);

    const gap = maxWeight - minWeight;
    let totalCount = 0;
    members.forEach((member) => {
      if (member) {
        member.weight = 0.1 + (gap ? (member.weight - minWeight) / gap : 0);
        totalCount += member.count;
      }
    });

    globalPRNG.setSeed(seed);
    const orders = globalPRNG.shuffle(Array.from({ length: totalCount }).map((_, i) => i));

    const idToOriginalIndexMap = new Map<number, number>();
    members.forEach((member) => {
      if (member) {
        for (let j = 0; j < member.count; j++) {
          const order = orders.pop() || 0;
          idToOriginalIndexMap.set(order, member.originalIndex);
          this._marbles.push(new Marble(this.physics, order, totalCount, member.name, member.weight));
        }
      }
    });

    this._totalMarbleCount = totalCount;
    this._winners = [];
    this._isRunning = true;
    this._winnerRank = this._marbles.length - 1;
    this._timeScale = 1;
    this._goalDist = Infinity;

    this.physics.start();
    this._marbles.forEach((m) => (m.isActive = true));

    let emergencyBreak = 0;
    while (this._isRunning && emergencyBreak < 100000) {
      emergencyBreak++;
      const interval = (this._updateInterval / 1000) * this._timeScale;
      this.physics.step(interval);
      this._updateMarbles(this._updateInterval);
      if (this._marbles.length > 1) {
        this._marbles.sort((a, b) => b.y - a.y);
      }
    }

    const finishOrderIds = this._getFinishOrderIds();
    if (finishOrderIds.length < totalCount) {
      this.reset();
      this._isSimulating = false;
      globalPRNG.setSeed(seed);
      return null;
    }

    const idToNameMap = new Map<number, string>();
    for (let i = 0; i < finishOrderIds.length && i < this._predeterminedOrder.length; i++) {
      idToNameMap.set(finishOrderIds[i], this._predeterminedOrder[i]);
    }

    const assignedNames = new Set(this._predeterminedOrder.slice(0, finishOrderIds.length));
    const unassignedNames = originalNames.filter((n) => !assignedNames.has(n));

    const finalNames = [...originalNames];
    const allSimulatedMarbles = [...this._winners, ...this._marbles];
    if (this._winner && !allSimulatedMarbles.includes(this._winner)) {
      allSimulatedMarbles.push(this._winner);
    }
    for (const marble of allSimulatedMarbles) {
      const origIndex = idToOriginalIndexMap.get(marble.id);
      if (origIndex !== undefined) {
        if (idToNameMap.has(marble.id)) {
          finalNames[origIndex] = idToNameMap.get(marble.id)!;
        } else {
          finalNames[origIndex] = unassignedNames.shift() || originalNames[origIndex];
        }
      }
    }

    this.reset();
    this._isSimulating = false;
    this._isRunning = false;

    // IMPORTANT: Reset the seed so the actual run produces identical physical results!
    globalPRNG.setSeed(seed);
    return finalNames;
  }

  public startSeating() {
    if (this._marbles.length === 0) {
      return;
    }

    const originalNames = this._marbles.map((marble) => marble.name);
    if (this._predeterminedOrder.length > 0) {
      const mappedNames = this._runHeadlessSimulationAndGetMappedNames(originalNames);
      if (mappedNames) {
        this.setMarbles(mappedNames);
      } else {
        this.setMarbles(originalNames);
      }
    }

    options.winningRank = this._marbles.length - 1;
    this.start();
  }

  public getWinners(): string[] {
    return this._winners.map((w) => w.name);
  }
}

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface Position {
  x: number;
  y: number;
}

interface GameState {
  snake: Position[];
  food: Position;
  direction: string;
  score: number;
  gameOver: boolean;
}

interface AIStats {
  generation: number;
  bestScore: number;
  currentScore: number;
  gamesPlayed: number;
  averageScore: number;
  fitness: number;
  avgSurvivalTime: number;
  recentProgress: number[];
  learningTrend: string;
}

const GRID_SIZE = 20;
const CANVAS_SIZE = 400;

class NeuralNetwork {
  weights1: number[][];
  weights2: number[][];
  weights3: number[][];
  bias1: number[];
  bias2: number[];
  bias3: number[];
  fitness: number = 0;
  
  constructor(copyFrom?: NeuralNetwork) {
    if (copyFrom) {
      this.weights1 = copyFrom.weights1.map(row => [...row]);
      this.weights2 = copyFrom.weights2.map(row => [...row]);
      this.weights3 = copyFrom.weights3.map(row => [...row]);
      this.bias1 = [...copyFrom.bias1];
      this.bias2 = [...copyFrom.bias2];
      this.bias3 = [...copyFrom.bias3];
    } else {
      this.weights1 = this.randomMatrix(32, 24, 0.5);
      this.weights2 = this.randomMatrix(24, 16, 0.5);
      this.weights3 = this.randomMatrix(16, 4, 1.0);
      this.bias1 = this.randomArray(24, 0.3);
      this.bias2 = this.randomArray(16, 0.3);
      this.bias3 = this.randomArray(4, 0.5);
    }
  }

  randomMatrix(inputs: number, outputs: number, scale: number = 1.0): number[][] {
    const limit = Math.sqrt(6 / (inputs + outputs)) * scale;
    return Array(inputs).fill(0).map(() => 
      Array(outputs).fill(0).map(() => (Math.random() * 2 - 1) * limit)
    );
  }

  randomArray(size: number, scale: number = 1.0): number[] {
    return Array(size).fill(0).map(() => (Math.random() * 2 - 1) * scale);
  }

  relu(x: number): number {
    return Math.max(0, x * 0.01 + (x > 0 ? x : 0));
  }

  tanh(x: number): number {
    return Math.tanh(x);
  }

  softmax(arr: number[]): number[] {
    const max = Math.max(...arr);
    const exp = arr.map(x => Math.exp(x - max));
    const sum = exp.reduce((a, b) => a + b, 0);
    return exp.map(x => x / sum);
  }

  predict(inputs: number[]): number[] {
    let layer1 = Array(24).fill(0);
    for (let i = 0; i < 24; i++) {
      let sum = this.bias1[i];
      for (let j = 0; j < inputs.length; j++) {
        sum += inputs[j] * this.weights1[j][i];
      }
      layer1[i] = this.relu(sum);
    }

    let layer2 = Array(16).fill(0);
    for (let i = 0; i < 16; i++) {
      let sum = this.bias2[i];
      for (let j = 0; j < layer1.length; j++) {
        sum += layer1[j] * this.weights2[j][i];
      }
      layer2[i] = this.relu(sum);
    }

    let output = Array(4).fill(0);
    for (let i = 0; i < 4; i++) {
      let sum = this.bias3[i];
      for (let j = 0; j < layer2.length; j++) {
        sum += layer2[j] * this.weights3[j][i];
      }
      output[i] = sum;
    }

    return this.softmax(output);
  }

  mutate(rate: number = 0.1, strength: number = 0.3): NeuralNetwork {
    const newNet = new NeuralNetwork(this);
    
    const mutateMatrix = (matrix: number[][]) => {
      for (let i = 0; i < matrix.length; i++) {
        for (let j = 0; j < matrix[i].length; j++) {
          if (Math.random() < rate) {
            matrix[i][j] += (Math.random() * 2 - 1) * strength;
            matrix[i][j] = Math.max(-2, Math.min(2, matrix[i][j]));
          }
        }
      }
    };

    const mutateArray = (arr: number[]) => {
      for (let i = 0; i < arr.length; i++) {
        if (Math.random() < rate) {
          arr[i] += (Math.random() * 2 - 1) * strength;
          arr[i] = Math.max(-2, Math.min(2, arr[i]));
        }
      }
    };

    mutateMatrix(newNet.weights1);
    mutateMatrix(newNet.weights2);
    mutateMatrix(newNet.weights3);
    mutateArray(newNet.bias1);
    mutateArray(newNet.bias2);
    mutateArray(newNet.bias3);

    return newNet;
  }

  crossover(other: NeuralNetwork): NeuralNetwork {
    const child = new NeuralNetwork();
    
    const crossMatrix = (m1: number[][], m2: number[][], result: number[][]) => {
      for (let i = 0; i < m1.length; i++) {
        for (let j = 0; j < m1[i].length; j++) {
          result[i][j] = Math.random() < 0.5 ? m1[i][j] : m2[i][j];
        }
      }
    };

    crossMatrix(this.weights1, other.weights1, child.weights1);
    crossMatrix(this.weights2, other.weights2, child.weights2);
    crossMatrix(this.weights3, other.weights3, child.weights3);

    for (let i = 0; i < this.bias1.length; i++) {
      child.bias1[i] = Math.random() < 0.5 ? this.bias1[i] : other.bias1[i];
    }
    for (let i = 0; i < this.bias2.length; i++) {
      child.bias2[i] = Math.random() < 0.5 ? this.bias2[i] : other.bias2[i];
    }
    for (let i = 0; i < this.bias3.length; i++) {
      child.bias3[i] = Math.random() < 0.5 ? this.bias3[i] : other.bias3[i];
    }

    return child;
  }
}

export default function SnakeAI() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>({
    snake: [{ x: 10, y: 10 }],
    food: { x: 15, y: 15 },
    direction: 'RIGHT',
    score: 0,
    gameOver: false
  });
  
  const [aiStats, setAiStats] = useState<AIStats>({
    generation: 1,
    bestScore: 0,
    currentScore: 0,
    gamesPlayed: 0,
    averageScore: 0,
    fitness: 0,
    avgSurvivalTime: 0,
    recentProgress: [],
    learningTrend: '🤔 观察中...'
  });

  const [isTraining, setIsTraining] = useState(false);
  const [speed, setSpeed] = useState(20);
  const [debugInfo, setDebugInfo] = useState({
    freeSpace: 0,
    trapRisk: 0,
    safetyMode: false,
    currentDecision: ''
  });
  const neuralNetRef = useRef(new NeuralNetwork());
  const bestNetRef = useRef(new NeuralNetwork());
  const gameHistoryRef = useRef<number[]>([]);
  const stepsWithoutFoodRef = useRef(0);

  const directions = ['UP', 'DOWN', 'LEFT', 'RIGHT'];

  const getGameInputs = useCallback((state: GameState): number[] => {
    const head = state.snake[0];
    const food = state.food;
    const inputs: number[] = [];

    const foodDx = food.x - head.x;
    const foodDy = food.y - head.y;
    const foodDistance = Math.sqrt(foodDx * foodDx + foodDy * foodDy);

    // 基础位置信息
    inputs.push(
      head.x / GRID_SIZE,
      head.y / GRID_SIZE,
      food.x / GRID_SIZE,  
      food.y / GRID_SIZE,
      foodDx / GRID_SIZE,
      foodDy / GRID_SIZE,
      foodDistance / (GRID_SIZE * Math.sqrt(2)),
      state.snake.length / (GRID_SIZE * GRID_SIZE)
    );

    // 增强身体感知：检查身体段的密度和分布
    const bodyDensityAround = [];
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        if (dx === 0 && dy === 0) continue;
        const checkX = head.x + dx;
        const checkY = head.y + dy;
        const hasBody = state.snake.some(seg => seg.x === checkX && seg.y === checkY);
        bodyDensityAround.push(hasBody ? 1 : 0);
      }
    }
    inputs.push(...bodyDensityAround.slice(0, 8)); // 只取前8个最重要的

    const directions = [
      { dx: 0, dy: -1, name: 'UP' },
      { dx: 0, dy: 1, name: 'DOWN' }, 
      { dx: -1, dy: 0, name: 'LEFT' },
      { dx: 1, dy: 0, name: 'RIGHT' }
    ];

    // 多步路径安全检查
    for (const dir of directions) {
      let safeSteps = 0;
      let foundFood = false;
      
      // 检查这个方向上连续几步都安全
      for (let step = 1; step <= 5; step++) {
        const checkX = head.x + dir.dx * step;
        const checkY = head.y + dir.dy * step;
        
        if (checkX < 0 || checkX >= GRID_SIZE || checkY < 0 || checkY >= GRID_SIZE) {
          break;
        }
        
        if (state.snake.some(seg => seg.x === checkX && seg.y === checkY)) {
          break;
        }
        
        safeSteps = step;
        
        if (checkX === food.x && checkY === food.y) {
          foundFood = true;
          break;
        }
      }
      
      inputs.push(
        safeSteps / 5.0, // 安全步数比例
        foundFood ? 1 : 0, // 这个方向能到食物
        state.direction === dir.name ? 1 : 0 // 当前方向
      );
    }

    // 检查尾巴位置 - 避免"咬尾巴"
    if (state.snake.length > 3) {
      const tail = state.snake[state.snake.length - 1];
      const secondTail = state.snake[state.snake.length - 2];
      inputs.push(
        Math.abs(head.x - tail.x) / GRID_SIZE,
        Math.abs(head.y - tail.y) / GRID_SIZE,
        Math.abs(head.x - secondTail.x) / GRID_SIZE,
        Math.abs(head.y - secondTail.y) / GRID_SIZE
      );
    } else {
      inputs.push(0, 0, 0, 0);
    }

    return inputs.slice(0, 32);
  }, []);

  const generateFood = useCallback((snake: Position[]): Position => {
    let newFood;
    do {
      newFood = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE)
      };
    } while (snake.some(segment => segment.x === newFood.x && segment.y === newFood.y));
    return newFood;
  }, []);

  const moveSnake = useCallback((state: GameState): GameState => {
    const head = { ...state.snake[0] };
    
    switch (state.direction) {
      case 'UP': head.y -= 1; break;
      case 'DOWN': head.y += 1; break;
      case 'LEFT': head.x -= 1; break;
      case 'RIGHT': head.x += 1; break;
    }

    if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
      return { ...state, gameOver: true };
    }

    if (state.snake.some(segment => segment.x === head.x && segment.y === head.y)) {
      return { ...state, gameOver: true };
    }

    const newSnake = [head, ...state.snake];
    let newFood = state.food;
    let newScore = state.score;

    if (head.x === state.food.x && head.y === state.food.y) {
      newScore += 10;
      newFood = generateFood(newSnake);
      stepsWithoutFoodRef.current = 0;
    } else {
      newSnake.pop();
      stepsWithoutFoodRef.current += 1;
    }

    if (stepsWithoutFoodRef.current > Math.max(40 + state.snake.length * 2, 60)) {
      return { ...state, gameOver: true };
    }

    return {
      ...state,
      snake: newSnake,
      food: newFood,
      score: newScore,
      gameOver: false
    };
  }, [generateFood]);

  const evaluateDirection = useCallback((state: GameState, direction: string): number => {
    const head = state.snake[0];
    let newHead = { ...head };
    
    switch (direction) {
      case 'UP': newHead.y -= 1; break;
      case 'DOWN': newHead.y += 1; break;
      case 'LEFT': newHead.x -= 1; break;
      case 'RIGHT': newHead.x += 1; break;
    }
    
    let score = 0;
    
    // 撞墙严重扣分
    if (newHead.x < 0 || newHead.x >= GRID_SIZE || newHead.y < 0 || newHead.y >= GRID_SIZE) {
      return -2000;
    }
    
    // 撞自己严重扣分
    if (state.snake.some(segment => segment.x === newHead.x && segment.y === newHead.y)) {
      return -2000;
    }
    
    // 反向移动扣分
    const isOppositeDirection = 
      (state.direction === 'UP' && direction === 'DOWN') ||
      (state.direction === 'DOWN' && direction === 'UP') ||
      (state.direction === 'LEFT' && direction === 'RIGHT') ||
      (state.direction === 'RIGHT' && direction === 'LEFT');
    if (isOppositeDirection) return -1500;
    
    // 空间感知 - 评估移动后的可用空间
    const freeSpaceAfterMove = calculateFreeSpace(newHead, state.snake);
    score += freeSpaceAfterMove * 10;
    
    // 身体陷阱检测 - 检查是否会被自己身体包围
    const trapRisk = calculateTrapRisk(newHead, state.snake);
    score -= trapRisk * 200;
    
    // 食物追逐策略 - 但不能过于激进
    const foodDx = state.food.x - newHead.x;
    const foodDy = state.food.y - newHead.y;
    const oldFoodDx = state.food.x - head.x;
    const oldFoodDy = state.food.y - head.y;
    
    const newDist = Math.abs(foodDx) + Math.abs(foodDy);
    const oldDist = Math.abs(oldFoodDx) + Math.abs(oldFoodDy);
    
    // 只有在安全的情况下才积极追食物
    if (freeSpaceAfterMove > 3 && trapRisk < 0.3) {
      if (newDist < oldDist) score += 80;
      else if (newDist > oldDist) score -= 30;
    } else {
      // 不安全时，远离食物反而更好
      if (newDist > oldDist) score += 40;
    }
    
    // 长期路径规划 - 检查前方5步的安全性
    let continuousSteps = 0;
    for (let step = 1; step <= 5; step++) {
      let checkHead = { ...newHead };
      switch (direction) {
        case 'UP': checkHead.y -= step; break;
        case 'DOWN': checkHead.y += step; break;
        case 'LEFT': checkHead.x -= step; break;
        case 'RIGHT': checkHead.x += step; break;
      }
      
      if (checkHead.x < 0 || checkHead.x >= GRID_SIZE || 
          checkHead.y < 0 || checkHead.y >= GRID_SIZE ||
          state.snake.some(segment => segment.x === checkHead.x && segment.y === checkHead.y)) {
        break;
      }
      continuousSteps++;
    }
    
    score += continuousSteps * 30; // 能走得越远越好
    
    // 尾巴跟随策略 - 有时跟着尾巴走是安全的
    if (state.snake.length > 4) {
      const tail = state.snake[state.snake.length - 1];
      const distToTail = Math.abs(newHead.x - tail.x) + Math.abs(newHead.y - tail.y);
      if (distToTail <= 2 && freeSpaceAfterMove < 4) {
        score += 60; // 靠近尾巴在狭窄空间是好策略
      }
    }
    
    return score;
  }, []);

  const calculateFreeSpace = useCallback((pos: Position, snake: Position[]): number => {
    let freeCount = 0;
    const visited = new Set<string>();
    const queue = [pos];
    
    while (queue.length > 0 && freeCount < 15) { // 限制搜索范围
      const current = queue.shift()!;
      const key = `${current.x},${current.y}`;
      
      if (visited.has(key)) continue;
      visited.add(key);
      
      if (current.x < 0 || current.x >= GRID_SIZE || 
          current.y < 0 || current.y >= GRID_SIZE ||
          snake.some(seg => seg.x === current.x && seg.y === current.y)) {
        continue;
      }
      
      freeCount++;
      
      // 添加邻居
      queue.push(
        {x: current.x + 1, y: current.y},
        {x: current.x - 1, y: current.y},
        {x: current.x, y: current.y + 1},
        {x: current.x, y: current.y - 1}
      );
    }
    
    return freeCount;
  }, []);

  const calculateTrapRisk = useCallback((pos: Position, snake: Position[]): number => {
    let surroundingBodyCount = 0;
    const checkPositions = [
      {x: pos.x + 1, y: pos.y}, {x: pos.x - 1, y: pos.y},
      {x: pos.x, y: pos.y + 1}, {x: pos.x, y: pos.y - 1},
      {x: pos.x + 1, y: pos.y + 1}, {x: pos.x - 1, y: pos.y - 1},
      {x: pos.x + 1, y: pos.y - 1}, {x: pos.x - 1, y: pos.y + 1}
    ];
    
    for (const checkPos of checkPositions) {
      if (checkPos.x < 0 || checkPos.x >= GRID_SIZE || 
          checkPos.y < 0 || checkPos.y >= GRID_SIZE ||
          snake.some(seg => seg.x === checkPos.x && seg.y === checkPos.y)) {
        surroundingBodyCount++;
      }
    }
    
    return surroundingBodyCount / 8.0; // 返回0-1的风险值
  }, []);

  const getAIDirection = useCallback((state: GameState): string => {
    const inputs = getGameInputs(state);
    const outputs = neuralNetRef.current.predict(inputs);
    
    // 实时计算调试信息
    const head = state.snake[0];
    const freeSpace = calculateFreeSpace(head, state.snake);
    const trapRisk = calculateTrapRisk(head, state.snake);
    const safetyMode = freeSpace < 4 || trapRisk > 0.5;
    
    const directionScores = directions.map((dir, index) => ({
      dir,
      aiScore: outputs[index] * 100,
      safetyScore: evaluateDirection(state, dir),
      totalScore: 0
    }));
    
    // 组合AI决策和安全评估
    directionScores.forEach(d => {
      d.totalScore = d.aiScore + d.safetyScore;
    });
    
    // 过滤出安全方向
    const safeDirs = directionScores.filter(d => d.safetyScore > -500);
    
    let chosenDirection;
    let decision = '';
    
    if (safeDirs.length === 0) {
      // 紧急情况，选择最不坏的选项
      const leastBad = directionScores.reduce((best, current) => 
        current.safetyScore > best.safetyScore ? current : best
      );
      chosenDirection = leastBad.dir;
      decision = '💀 紧急避险';
    } else {
      // 选择总分最高的安全方向
      const bestDirection = safeDirs.reduce((best, current) => 
        current.totalScore > best.totalScore ? current : best
      );
      chosenDirection = bestDirection.dir;
      
      if (safetyMode) {
        decision = '🛡️ 安全优先';
      } else {
        decision = '🎯 追逐食物';
      }
    }
    
    // 更新调试信息
    setDebugInfo({
      freeSpace: Math.round(freeSpace),
      trapRisk: Math.round(trapRisk * 100),
      safetyMode,
      currentDecision: decision
    });
    
    return chosenDirection;
  }, [getGameInputs, evaluateDirection, calculateFreeSpace, calculateTrapRisk]);

  const resetGame = useCallback(() => {
    const initialState = {
      snake: [{ x: Math.floor(GRID_SIZE / 2), y: Math.floor(GRID_SIZE / 2) }],
      food: { x: 0, y: 0 },
      direction: 'RIGHT',
      score: 0,
      gameOver: false
    };
    initialState.food = generateFood(initialState.snake);
    stepsWithoutFoodRef.current = 0;
    gameStartTimeRef.current = Date.now();
    return initialState;
  }, [generateFood]);

  const drawGame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    const cellSize = CANVAS_SIZE / GRID_SIZE;

    ctx.fillStyle = '#0f0';
    gameState.snake.forEach((segment, index) => {
      ctx.fillStyle = index === 0 ? '#0a0' : '#0f0';
      ctx.fillRect(segment.x * cellSize, segment.y * cellSize, cellSize - 1, cellSize - 1);
    });

    ctx.fillStyle = '#f00';
    ctx.fillRect(gameState.food.x * cellSize, gameState.food.y * cellSize, cellSize - 1, cellSize - 1);
  }, [gameState]);

  const populationRef = useRef<NeuralNetwork[]>([]);
  const generationRef = useRef(0);
  const fitnessHistoryRef = useRef<number[]>([]);
  const survivalTimeRef = useRef<number[]>([]);
  const gameStartTimeRef = useRef(0);

  const previousDistanceRef = useRef(0);
  const currentRewardRef = useRef(0);

  const calculateFitness = useCallback((score: number, steps: number, snake: Position[], currentDistance: number): number => {
    const survivalBonus = Math.min(steps / 3, 150);
    const lengthBonus = (snake.length - 1) * 100;
    const scoreBonus = score * 500; // 提高食物奖励
    
    // 安全奖励 - 长时间存活很重要
    const safetyBonus = steps > 100 ? Math.min((steps - 100) / 10, 200) : 0;
    
    // 效率奖励 - 但不能过度追求效率导致冒险
    const efficiencyBonus = score > 0 ? Math.min((score / Math.max(steps / 80, 1)) * 30, 100) : 0;
    
    // 成长奖励 - 长蛇指数级奖励
    const growthMultiplier = snake.length > 5 ? Math.pow(1.5, Math.min(snake.length - 5, 10)) : 1;
    
    // 探索与保守平衡
    const explorationPenalty = stepsWithoutFoodRef.current > 40 ? -(stepsWithoutFoodRef.current - 40) * 3 : 0;
    
    // 急躁惩罚 - 防止过于激进追食物
    const recklessPenalty = currentRewardRef.current < -20 ? Math.abs(currentRewardRef.current) : 0;
    
    const totalFitness = (scoreBonus + lengthBonus * growthMultiplier + survivalBonus + safetyBonus + efficiencyBonus + explorationPenalty + currentRewardRef.current) - recklessPenalty;
    
    return Math.max(totalFitness, 0); // 确保fitness不为负
  }, []);

  const updateRealtimeRewards = useCallback((state: GameState) => {
    const head = state.snake[0];
    const food = state.food;
    const currentDistance = Math.abs(head.x - food.x) + Math.abs(head.y - food.y);
    
    // 计算可用空间作为安全指标
    const freeSpace = calculateFreeSpace(head, state.snake);
    const trapRisk = calculateTrapRisk(head, state.snake);
    
    if (previousDistanceRef.current > 0) {
      const distanceChange = previousDistanceRef.current - currentDistance;
      
      // 根据安全状况调整奖励
      if (freeSpace > 5 && trapRisk < 0.4) {
        // 安全时积极追食物
        if (distanceChange > 0) currentRewardRef.current += 8;
        else if (distanceChange < 0) currentRewardRef.current -= 3;
      } else if (freeSpace < 3 || trapRisk > 0.6) {
        // 危险时优先安全，远离食物也是好选择
        if (distanceChange > 0) currentRewardRef.current += 2; // 小奖励
        else if (distanceChange < 0) currentRewardRef.current += 5; // 保守策略奖励
      } else {
        // 中等安全时平衡策略
        if (distanceChange > 0) currentRewardRef.current += 4;
        else if (distanceChange < 0) currentRewardRef.current -= 1;
      }
    }
    
    // 生存时间奖励
    if (stepsWithoutFoodRef.current < 30) {
      currentRewardRef.current += 0.5; // 健康状态小奖励
    } else if (stepsWithoutFoodRef.current > 50) {
      currentRewardRef.current -= (stepsWithoutFoodRef.current - 50) * 0.8;
    }
    
    // 空间管理奖励
    if (freeSpace > 8) currentRewardRef.current += 2; // 保持开阔空间
    if (trapRisk > 0.7) currentRewardRef.current -= 10; // 陷入困境严重扣分
    
    previousDistanceRef.current = currentDistance;
  }, [calculateFreeSpace, calculateTrapRisk]);

  const evolveAI = useCallback(() => {
    const currentScore = gameState.score;
    const head = gameState.snake[0];
    const food = gameState.food;
    const currentDistance = Math.abs(head.x - food.x) + Math.abs(head.y - food.y);
    const survivalTime = Date.now() - gameStartTimeRef.current;
    const fitness = calculateFitness(currentScore, stepsWithoutFoodRef.current + currentScore * 10, gameState.snake, currentDistance);
    
    neuralNetRef.current.fitness = fitness;
    gameHistoryRef.current.push(currentScore);
    fitnessHistoryRef.current.push(fitness);
    survivalTimeRef.current.push(survivalTime);
    
    previousDistanceRef.current = 0;
    currentRewardRef.current = 0;
    
    if (currentScore > aiStats.bestScore) {
      bestNetRef.current = new NeuralNetwork(neuralNetRef.current);
      setAiStats(prev => ({ ...prev, bestScore: currentScore }));
    }

    if (populationRef.current.length < 20) {
      populationRef.current.push(new NeuralNetwork(neuralNetRef.current));
    } else {
      populationRef.current[generationRef.current % 20] = new NeuralNetwork(neuralNetRef.current);
    }

    if (gameHistoryRef.current.length >= 5) {
      const recentFitness = fitnessHistoryRef.current.slice(-5);
      const avgFitness = recentFitness.reduce((a, b) => a + b, 0) / recentFitness.length;
      const avgScore = gameHistoryRef.current.slice(-5).reduce((a, b) => a + b, 0) / 5;

      populationRef.current.sort((a, b) => (b.fitness || 0) - (a.fitness || 0));
      
      if (populationRef.current.length >= 10) {
        const parent1 = populationRef.current[0];
        const parent2 = populationRef.current[1];
        
        if (Math.random() < 0.7 && parent1 && parent2) {
          neuralNetRef.current = parent1.crossover(parent2).mutate(0.15, 0.4);
        } else if (avgFitness < (fitnessHistoryRef.current.slice(-20, -5).reduce((a, b) => a + b, 0) / 15) * 0.8) {
          neuralNetRef.current = bestNetRef.current.mutate(0.3, 0.6);
        } else {
          neuralNetRef.current = bestNetRef.current.mutate(0.1, 0.3);
        }
      } else {
        neuralNetRef.current = bestNetRef.current.mutate(0.2, 0.5);
      }

      generationRef.current++;
      
      // 计算学习趋势
      const recentScores = gameHistoryRef.current.slice(-20);
      const recentSurvival = survivalTimeRef.current.slice(-10).map(t => t / 1000);
      const avgSurvivalTime = recentSurvival.reduce((a, b) => a + b, 0) / recentSurvival.length;
      
      let learningTrend = '🤔 观察中...';
      if (recentScores.length >= 10) {
        const firstHalf = recentScores.slice(0, Math.floor(recentScores.length / 2));
        const secondHalf = recentScores.slice(Math.floor(recentScores.length / 2));
        const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
        
        if (secondAvg > firstAvg * 1.2) learningTrend = '🚀 快速学习中！';
        else if (secondAvg > firstAvg * 1.05) learningTrend = '📈 稳步改进';
        else if (secondAvg > firstAvg * 0.95) learningTrend = '🔄 缓慢进步';
        else learningTrend = '😵 可能退化了...';
      }
      
      setAiStats(prev => ({
        ...prev,
        generation: generationRef.current,
        gamesPlayed: prev.gamesPlayed + 1,
        averageScore: avgScore,
        currentScore: 0,
        fitness: avgFitness,
        avgSurvivalTime: avgSurvivalTime,
        recentProgress: recentScores.slice(-10),
        learningTrend
      }));
    }
  }, [gameState.score, gameState.snake, aiStats.bestScore, calculateFitness]);

  useEffect(() => {
    drawGame();
  }, [drawGame]);

  useEffect(() => {
    if (!isTraining) return;

    const gameLoop = setInterval(() => {
      setGameState(prevState => {
        if (prevState.gameOver) {
          evolveAI();
          return resetGame();
        }

        updateRealtimeRewards(prevState);
        const aiDirection = getAIDirection(prevState);
        const newState = { ...prevState, direction: aiDirection };
        const movedState = moveSnake(newState);
        
        setAiStats(prev => ({
          ...prev,
          currentScore: movedState.score
        }));

        return movedState;
      });
    }, 1000 / speed);

    return () => clearInterval(gameLoop);
  }, [isTraining, speed, getAIDirection, moveSnake, resetGame, evolveAI]);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-8">🐍 AI贪吃蛇进化实验</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-2xl font-bold mb-4">🎮 游戏画面</h2>
            <canvas
              ref={canvasRef}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              className="border-2 border-gray-600 rounded-lg mx-auto block"
            />
            
            <div className="mt-4 flex flex-col gap-4">
              <div className="flex gap-4">
                <button
                  onClick={() => setIsTraining(!isTraining)}
                  className={`px-6 py-3 rounded-lg font-bold ${
                    isTraining 
                      ? 'bg-red-600 hover:bg-red-700' 
                      : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {isTraining ? '⏸️ 停止训练' : '▶️ 开始训练'}
                </button>
                
                <button
                  onClick={() => {
                    setGameState(resetGame());
                    setAiStats({
                      generation: 1,
                      bestScore: 0,
                      currentScore: 0,
                      gamesPlayed: 0,
                      averageScore: 0,
                      fitness: 0,
                      avgSurvivalTime: 0,
                      recentProgress: [],
                      learningTrend: '🤔 观察中...'
                    });
                    gameHistoryRef.current = [];
                  }}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold"
                >
                  🔄 重置
                </button>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">
                  训练速度: {speed}x
                </label>
                <input
                  type="range"
                  min="1"
                  max="4000"
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>1x</span>
                  <span>1000x</span>
                  <span>2000x</span>
                  <span>4000x</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-2xl font-bold mb-4">📊 AI进化统计</h2>
            
            <div className="space-y-4">
              <div className="bg-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-bold text-green-400">当前状态</h3>
                <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                  <div>世代: <span className="font-bold">{aiStats.generation}</span></div>
                  <div>当前分数: <span className="font-bold">{aiStats.currentScore}</span></div>
                  <div>游戏状态: <span className="font-bold">{gameState.gameOver ? '💀 死亡' : '🟢 存活'}</span></div>
                  <div>训练状态: <span className="font-bold">{isTraining ? '🚀 训练中' : '⏸️ 暂停'}</span></div>
                </div>
                <div className="mt-3 p-2 bg-gray-600 rounded text-center">
                  <div className="text-sm font-bold">学习趋势</div>
                  <div className="text-lg">{aiStats.learningTrend}</div>
                </div>
              </div>

              <div className="bg-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-bold text-blue-400">历史最佳</h3>
                <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                  <div>最高分数: <span className="font-bold text-yellow-400">{aiStats.bestScore}</span></div>
                  <div>游戏场数: <span className="font-bold">{aiStats.gamesPlayed}</span></div>
                  <div>平均分数: <span className="font-bold">{aiStats.averageScore.toFixed(1)}</span></div>
                  <div>适应度: <span className="font-bold">{aiStats.fitness.toFixed(1)}</span></div>
                  <div>平均存活: <span className="font-bold">{aiStats.avgSurvivalTime.toFixed(1)}秒</span></div>
                  <div>最近10局: <span className="font-bold">[{aiStats.recentProgress.join(', ')}]</span></div>
                </div>
              </div>

              <div className="bg-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-bold text-purple-400">蛇的信息</h3>
                <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                  <div>蛇身长度: <span className="font-bold">{gameState.snake.length}</span></div>
                  <div>移动方向: <span className="font-bold">{gameState.direction}</span></div>
                  <div>头部位置: <span className="font-bold">({gameState.snake[0]?.x}, {gameState.snake[0]?.y})</span></div>
                  <div>食物位置: <span className="font-bold">({gameState.food.x}, {gameState.food.y})</span></div>
                </div>
              </div>

              <div className="bg-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-bold text-orange-400">AI决策状态</h3>
                <div className="text-sm space-y-2">
                  <p>🧠 当前策略: <span className="font-bold">{debugInfo.currentDecision}</span></p>
                  <p>🌍 可用空间: <span className="font-bold">{debugInfo.freeSpace}</span> 格</p>
                  <p>⚠️ 陷阱风险: <span className="font-bold">{debugInfo.trapRisk}%</span></p>
                  <p>🛡️ 安全模式: <span className="font-bold">{debugInfo.safetyMode ? '✅ 启用' : '❌ 关闭'}</span></p>
                </div>
              </div>

              <div className="bg-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-bold text-purple-400">算法改进</h3>
                <div className="text-sm space-y-2">
                  <p>🔍 身体感知: 5×5区域密度检测</p>
                  <p>🚶 路径规划: 前瞻5步安全性</p>
                  <p>⚖️ 动态平衡: 安全时追食物，危险时保守</p>
                  <p>🧭 空间管理: 避免自我包围陷阱</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 bg-gray-800 rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-4">📈 训练进度可视化</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-700 rounded-lg p-4">
              <h4 className="font-bold text-center">当前分数</h4>
              <div className="text-3xl font-bold text-center text-green-400 mt-2">
                {aiStats.currentScore}
              </div>
              <div className="w-full bg-gray-600 rounded-full h-2 mt-2">
                <div 
                  className="bg-green-400 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min((aiStats.currentScore / Math.max(aiStats.bestScore, 1)) * 100, 100)}%` }}
                ></div>
              </div>
            </div>
            
            <div className="bg-gray-700 rounded-lg p-4">
              <h4 className="font-bold text-center">历史最高</h4>
              <div className="text-3xl font-bold text-center text-yellow-400 mt-2">
                {aiStats.bestScore}
              </div>
              <div className="text-center text-sm text-gray-400 mt-2">
                世代 #{aiStats.generation}
              </div>
            </div>
            
            <div className="bg-gray-700 rounded-lg p-4">
              <h4 className="font-bold text-center">平均表现</h4>
              <div className="text-3xl font-bold text-center text-blue-400 mt-2">
                {aiStats.averageScore.toFixed(1)}
              </div>
              <div className="text-center text-sm text-gray-400 mt-2">
                最近10局平均
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
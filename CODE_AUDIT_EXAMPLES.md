# 🔍 Code Audit Examples - Learning to Code Like a Senior

> Hướng dẫn chi tiết cách audit code từng bước, nhận biết lỗi, và cải thiện từ beginner đến expert level.

---

## 🎯 Mục Tiêu

Học cách:
- ✅ Nhận biết **anti-patterns** (các cách viết code SAI)
- ✅ Hiểu **WHY** (tại sao SAI)
- ✅ Biết **cách FIX** (viết đúng)
- ✅ Áp dụng vào **project betting API**

---

## 📚 Cấu Trúc File

```
LEVEL 1: BASIC SMELLS (Beginner)
├─ Kiểm tra input
├─ Error handling
├─ SQL Injection
└─ Tách code thành layers

LEVEL 2: INTERMEDIATE ISSUES (Intermediate)
├─ N+1 Query problem
├─ Efficient filtering
├─ Query optimization
└─ Business logic placement

LEVEL 3: RACE CONDITIONS (Advanced)
├─ Race condition examples
├─ Pessimistic locking
├─ Optimistic locking
└─ Atomic operations

LEVEL 4: PRODUCTION PATTERNS (Expert)
├─ Complex transactions
├─ Advanced caching
├─ Memory management
└─ Real-world implementations
```

---

# 🟥 LEVEL 1: BASIC CODE SMELLS

## 1.1 Input Validation (❌ vs ✅)

### ❌ SAI: Không validate input

```typescript
@Post('/users')
async createUser(@Body() body: any) {
  // Có gì có?
  console.log(body);
  
  const user = await db.query(`
    INSERT INTO users (username, email, password) 
    VALUES ('${body.username}', '${body.email}', '${body.password}')
  `);
  
  return user;
}
```

**🔴 Vấn đề:**
- Username = `'; DROP TABLE users; --` → SQL Injection! 💣
- Username = `""` (empty) → lỗi
- Email = `not-an-email` → lỗi
- Password = `123` (quá ngắn) → bảo mật xấu
- Không biết request data có gì

---

### ✅ ĐÚNG: Validate everything

```typescript
// Step 1: Define DTO (Data Transfer Object)
import { IsString, IsEmail, MinLength, MaxLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MinLength(3, { message: 'Username phải từ 3 ký tự' })
  @MaxLength(50)
  username: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8, { message: 'Password phải từ 8 ký tự' })
  password: string;
}

// Step 2: Use DTO in controller
@Post('/users')
@UsePipes(ValidationPipe)  // Tự động validate DTO
async createUser(@Body() dto: CreateUserDto) {
  // ✅ Tại đây, biết chắc dto.username, email, password hợp lệ
  
  const user = await this.userService.createUser(dto);
  return user;
}

// Step 3: Use validated data in service
@Injectable()
export class UserService {
  async createUser(dto: CreateUserDto): Promise<User> {
    // Check exists
    const existing = await this.userRepo.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }
    
    // Hash password (NEVER store plain text!)
    const hashedPassword = await bcrypt.hash(dto.password, 10);
    
    // Create user
    return this.userRepo.create({
      username: dto.username,
      email: dto.email,
      password: hashedPassword
    });
  }
}
```

**✅ Lợi ích:**
- SQL injection ngăn chặn (TypeORM escaped queries)
- Input luôn hợp lệ
- Code self-documenting (DTO = API contract)
- Reusable across endpoints
- Type-safe

---

## 1.2 Error Handling (❌ vs ✅)

### ❌ SAI: Không handle errors

```typescript
@Get('/users/:id')
async getUser(@Param('id') id: number) {
  const user = await userRepository.findOne({ where: { id } });
  
  return user; // Nếu không tìm thấy, trả null → API return null, client confused
}

// Client receives: null
// Client không biết: user thực sự không tồn tại? hay lỗi database?
```

---

### ✅ ĐÚNG: Handle all cases explicitly

```typescript
@Get('/users/:id')
async getUser(@Param('id', ParseIntPipe) id: number): Promise<UserResponseDto> {
  const user = await this.userService.getUser(id);
  
  // ✅ Nếu không tìm thấy, throw exception
  // NestJS converts to HTTP 404
  
  return UserResponseDto.fromEntity(user);
}

// Service
@Injectable()
export class UserService {
  async getUser(id: number): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    
    return user;
  }
}

// Responses:
// ✅ User exists: HTTP 200 + user data
// ✅ User not found: HTTP 404 + { message: 'User 999 not found' }
// ✅ Invalid ID: HTTP 400 + { message: 'ID must be number' }
// ✅ Database error: HTTP 500 + { message: 'Internal server error' }
```

---

## 1.3 Sensitive Data Leakage (❌ vs ✅)

### ❌ SAI: Return tất cả fields

```typescript
@Get('/users/:id')
async getUser(@Param('id') id: number) {
  const user = await userRepository.findOne({ where: { id } });
  return user; // ⚠️ Trả về tất cả: password, ssn, credit card, ...
}

// Response:
{
  "id": 1,
  "username": "john",
  "email": "john@example.com",
  "password": "$2b$10$abcdefghijklmnopqrstuvwxyz", // ❌ Password hash exposed!
  "ssn": "123-45-6789",                            // ❌ SSN exposed!
  "creditCard": "1234-5678-9012-3456",             // ❌ Credit card exposed!
  "createdAt": "2024-01-01T00:00:00Z"
}
```

---

### ✅ ĐÚNG: Return only public fields

```typescript
// Step 1: Define Response DTO (public fields only)
export class UserResponseDto {
  id: number;
  username: string;
  email: string;
  createdAt: Date;

  // ✅ Exclude: password, ssn, creditCard, ...

  static fromEntity(user: User): UserResponseDto {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      createdAt: user.createdAt
      // password, ssn, creditCard NOT included!
    };
  }
}

// Step 2: Use in controller
@Get('/users/:id')
async getUser(@Param('id') id: number): Promise<UserResponseDto> {
  const user = await this.userService.getUser(id);
  return UserResponseDto.fromEntity(user); // ✅ Only public data
}

// Response:
{
  "id": 1,
  "username": "john",
  "email": "john@example.com",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

---

## 1.4 Code Organization (❌ vs ✅)

### ❌ SAI: Everything in one file

```typescript
// app.ts - 500+ lines, does everything
import { Elysia } from 'elysia';
import { db } from './database';

const app = new Elysia();

// User endpoints
app.post('/users', async ({ body }: any) => {
  // validate
  // hash password
  // create user
  // send email
  // ...
});

app.get('/users/:id', async ({ params }: any) => {
  // ...
});

// Bet endpoints
app.post('/bets', async ({ body }: any) => {
  // validate
  // check balance
  // deduct balance
  // create bet
  // match opponent
  // ...
});

// Database queries scattered everywhere
// Error handling scattered
// No reusability
// Hard to test
// Hard to maintain
```

---

### ✅ ĐÚNG: Layered architecture

```typescript
// src/entities/User.ts - Database model
@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  username: string;

  // ...
}

// src/dto/user/CreateUserDto.ts - Input validation
export class CreateUserDto {
  @IsString()
  @MinLength(3)
  username: string;
  // ...
}

// src/dto/user/UserResponseDto.ts - Output format
export class UserResponseDto {
  id: number;
  username: string;
  // ... (no sensitive data)
}

// src/repositories/UserRepository.ts - Database operations
@Injectable()
export class UserRepository {
  constructor(@InjectRepository(User) private repo: Repository<User>) {}

  async findById(id: number): Promise<User | null> {
    return this.repo.findOne({ where: { id } });
  }

  async create(data: Partial<User>): Promise<User> {
    return this.repo.save(data);
  }
}

// src/services/UserService.ts - Business logic
@Injectable()
export class UserService {
  constructor(
    private userRepo: UserRepository,
    private hashService: HashService,
    private emailService: EmailService
  ) {}

  async createUser(dto: CreateUserDto): Promise<User> {
    const existing = await this.userRepo.findByEmail(dto.email);
    if (existing) throw new ConflictException('Email exists');

    const hashedPassword = await this.hashService.hash(dto.password);

    return this.userRepo.create({
      ...dto,
      password: hashedPassword
    });
  }
}

// src/controllers/UserController.ts - HTTP handling
@Controller('api/users')
export class UserController {
  constructor(private userService: UserService) {}

  @Post()
  async createUser(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
    const user = await this.userService.createUser(dto);
    return UserResponseDto.fromEntity(user);
  }

  @Get(':id')
  async getUser(@Param('id') id: number): Promise<UserResponseDto> {
    const user = await this.userService.getUser(id);
    return UserResponseDto.fromEntity(user);
  }
}

// app.module.ts - Wire everything together
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UserRepository, UserService, HashService, EmailService],
  controllers: [UserController]
})
export class AppModule {}
```

**✅ Lợi ích:**
- Mỗi file, một trách nhiệm rõ ràng
- Dễ test (mock dependencies)
- Dễ reuse (service dùng lại)
- Dễ maintain (sửa một chỗ, không ảnh hưởng chỗ khác)
- Dễ scale (thêm feature không phức tạp)

---

# 🟨 LEVEL 2: INTERMEDIATE ISSUES

## 2.1 N+1 Query Problem (❌ vs ✅)

### ❌ SAI: Load data trong loop

```typescript
async function getPostsWithComments(userId: number) {
  // Query 1: Get user
  const user = await userRepository.findOne({ where: { id: userId } });

  // Query 2: Get user's posts
  const posts = await postRepository.find({ where: { userId } });

  // Queries 3-100: Load comments for each post
  for (const post of posts) {
    post.comments = await commentRepository.find({
      where: { postId: post.id }
    });
  }

  return { user, posts };
}

// If user has 100 posts:
// 1 + 1 + 100 = 102 queries! 😱
// Database time: ~5,000ms
```

---

### ✅ ĐÚNG: Load with relations (JOIN)

```typescript
async function getPostsWithComments(userId: number) {
  return postRepository
    .createQueryBuilder('post')
    .where('post.userId = :userId', { userId })
    .leftJoinAndSelect('post.comments', 'comment')
    .orderBy('post.createdAt', 'DESC')
    .addOrderBy('comment.createdAt', 'ASC')
    .getMany();
}

// 1 query with JOIN
// Database time: ~50ms
// 100x FASTER!
```

---

## 2.2 Loading Unnecessary Data (❌ vs ✅)

### ❌ SAI: Load everything

```typescript
async function getUserDashboard(userId: number) {
  const user = await userRepository.findOne({
    where: { id: userId },
    relations: [
      'bets',              // 10,000 bets
      'bets.round',
      'bets.round.arena',
      'transactions',      // 50,000 transactions
      'affiliates',        // 1,000 affiliates
      'profile',
      'settings'
    ]
  });

  return user;
}

// Loads 60,000+ rows
// Memory: 500MB
// Database time: ~10,000ms
```

---

### ✅ ĐÚNG: Load only what's needed

```typescript
// Query 1: User basic info
async function getUserBasic(userId: number) {
  return userRepository.findOne({
    where: { id: userId },
    relations: ['profile', 'settings']
  });
}
// Time: ~10ms

// Query 2: Recent bets
async function getUserRecentBets(userId: number) {
  return betRepository.find({
    where: { userId },
    relations: ['round'],
    order: { createdAt: 'DESC' },
    take: 20 // Only last 20
  });
}
// Time: ~20ms

// Query 3: Statistics (aggregated)
async function getUserStats(userId: number) {
  return userRepository
    .createQueryBuilder('user')
    .select('COUNT(bet.id)', 'totalBets')
    .addSelect('SUM(bet.amount)', 'totalAmount')
    .addSelect('AVG(bet.odds)', 'avgOdds')
    .leftJoin('user.bets', 'bet')
    .where('user.id = :userId', { userId })
    .groupBy('user.id')
    .getRawOne();
}
// Time: ~30ms

// In controller
@Get('dashboard')
async getDashboard(@CurrentUser() user: User) {
  const [userBasic, recentBets, stats] = await Promise.all([
    this.userService.getUserBasic(user.id),
    this.userService.getUserRecentBets(user.id),
    this.userService.getUserStats(user.id)
  ]);

  return { user: userBasic, bets: recentBets, stats };
}

// Total time: ~30ms (parallel)
// vs 10,000ms (sequential load everything)
```

---

## 2.3 Inefficient Filtering (❌ vs ✅)

### ❌ SAI: Filter in memory

```typescript
async function getExpensiveBets(minAmount: number = 1000000) {
  // Load ALL bets (1,000,000 rows!)
  const allBets = await betRepository.find();

  // Filter in Node.js memory
  return allBets.filter(bet => bet.amount >= minAmount);
}

// Memory: 2GB
// Time: 30,000ms
```

---

### ✅ ĐÚNG: Filter in database

```typescript
async function getExpensiveBets(minAmount: number = 1000000) {
  return betRepository.find({
    where: {
      amount: MoreThanOrEqual(minAmount)
    },
    order: { amount: 'DESC' },
    take: 100
  });
}

// Memory: 10KB
// Time: 50ms
// 600x FASTER!
```

---

## 2.4 Business Logic Placement (❌ vs ✅)

### ❌ SAI: Logic in controller

```typescript
@Post('bets')
async placeBet(@Body() dto: PlaceBetDto, @CurrentUser() user: User) {
  // 100+ lines of logic in controller

  const round = await roundRepository.findOne({ where: { id: dto.roundId } });
  if (!round) throw new NotFoundException();
  if (round.status !== 'BETTING') throw new BadRequestException();

  const existing = await betRepository.findOne({
    where: { userId: user.id, roundId: dto.roundId }
  });
  if (existing) throw new ConflictException();

  if (user.balance < dto.amount) throw new BadRequestException();

  const odds = this.calculateOdds(dto.choice);
  
  await dataSource.transaction(async manager => {
    await manager.decrement(User, { id: user.id }, 'balance', dto.amount);
    const bet = await manager.save(Bet, {
      userId: user.id,
      roundId: dto.roundId,
      choice: dto.choice,
      amount: dto.amount,
      odds
    });
    // ... more code
  });
}

// Problems:
// ❌ Hard to test
// ❌ Hard to reuse
// ❌ Hard to maintain
// ❌ Mixed concerns
```

---

### ✅ ĐÚNG: Logic in service

```typescript
// Controller: Only HTTP concerns
@Controller('api/bets')
export class BetController {
  constructor(private betService: BetService) {}

  @Post()
  async placeBet(
    @Body() dto: PlaceBetDto,
    @CurrentUser() user: User
  ): Promise<BetResponseDto> {
    const bet = await this.betService.placeBet(dto, user.id);
    return BetResponseDto.fromEntity(bet);
  }
}

// Service: All business logic
@Injectable()
export class BetService {
  constructor(
    private betRepo: BetRepository,
    private roundRepo: RoundRepository,
    private userRepo: UserRepository,
    private dataSource: DataSource
  ) {}

  async placeBet(dto: PlaceBetDto, userId: number): Promise<Bet> {
    // Validate
    await this.validateBetPlacement(dto, userId);

    // Calculate
    const odds = this.calculateOdds(dto.choice);
    const payout = dto.amount * odds;

    // Execute
    return this.executeBetTransaction(dto, userId, odds, payout);
  }

  private async validateBetPlacement(dto: PlaceBetDto, userId: number) {
    const round = await this.roundRepo.findById(dto.roundId);
    if (!round) throw new NotFoundException();
    if (round.status !== 'BETTING') throw new BadRequestException();

    const existing = await this.betRepo.findByUserAndRound(userId, dto.roundId);
    if (existing) throw new ConflictException();

    const user = await this.userRepo.findById(userId);
    if (user.balance < dto.amount) throw new InsufficientBalanceError();
  }

  private async executeBetTransaction(
    dto: PlaceBetDto,
    userId: number,
    odds: number,
    payout: number
  ): Promise<Bet> {
    return this.dataSource.transaction(async (manager) => {
      await this.userRepo.deductBalance(userId, dto.amount, manager);
      return this.betRepo.create({
        userId,
        roundId: dto.roundId,
        choice: dto.choice,
        amount: dto.amount,
        odds,
        potentialPayout: payout
      }, manager);
    });
  }
}

// Benefits:
// ✅ Easy to test (mock repo)
// ✅ Easy to reuse (other controllers can call service)
// ✅ Easy to maintain
// ✅ Clear separation of concerns
```

---

# 🟦 LEVEL 3: RACE CONDITIONS & LOCKING

## 3.1 Race Condition (❌ vs ✅)

### ❌ SAI: No locking

```typescript
async function placeBet(userId: number, amount: number) {
  // T1: Request A reads balance = 100,000
  const user = await userRepository.findOne({ where: { id: userId } });

  // T2: Request B reads balance = 100,000 (same!)
  
  // Check
  if (user.balance >= amount) {
    // T3: Request A deducts: balance = 0
    await userRepository.update({ id: userId }, {
      balance: user.balance - amount
    });

    // T4: Request B deducts: balance = -100,000 😱
    await userRepository.update({ id: userId }, {
      balance: user.balance - amount
    });
  }
}

// Result: User has negative balance! Both bets went through!
```

---

### ✅ ĐÚNG: Use pessimistic locking

```typescript
async function placeBet(userId: number, amount: number) {
  await dataSource.transaction(async (manager) => {
    // Lock the user row for writing
    const user = await manager
      .createQueryBuilder(User, 'user')
      .setLock('pessimistic_write') // 🔒 LOCK!
      .where('user.id = :userId', { userId })
      .getOne();

    if (!user) throw new NotFoundException();
    if (user.balance < amount) throw new InsufficientBalanceError();

    // Only ONE request can be here at a time
    await manager.decrement(User, { id: userId }, 'balance', amount);

    const bet = await manager.save(Bet, {
      userId,
      amount,
      status: 'PENDING'
    });

    return bet;
  });
}

// Timeline with locking:
// T1: Request A locks user row
// T2: Request B waits for lock...
// T3: Request A deducts, commits, releases lock
// T4: Request B acquires lock, reads NEW balance, fails validation ✅
```

---

## 3.2 FOR UPDATE SKIP LOCKED Pattern (Advanced)

```typescript
// Scenario: Auto-match workers finding opponents
// Multiple workers trying to find unbetted matches

// ❌ SAI: All workers lock each other

// ✅ ĐÚNG: SKIP LOCKED - workers don't block each other

async function findAndMatchOpponents() {
  return dataSource.query(`
    SELECT * FROM bets
    WHERE status = 'PENDING'
      AND NOT matched
    ORDER BY amount ASC, createdAt ASC
    FOR UPDATE SKIP LOCKED  -- 🔓 Lock found rows, skip locked ones
    LIMIT 10
  `);
}

// With SKIP LOCKED:
// Worker 1 finds and locks bet A, B, C
// Worker 2 skips A, B, C and finds D, E, F (no blocking!)
// Workers run in parallel, no thundering herd!
```

---

# 🟩 LEVEL 4: PRODUCTION PATTERNS

## 4.1 Complex Transaction with Multiple Steps

```typescript
// Scenario: Complete betting round, process payouts

@Injectable()
export class RoundCompletionService {
  async completeRound(roundId: number, winner: string): Promise<void> {
    return this.dataSource.transaction('SERIALIZABLE', async (manager) => {
      // Step 1: Lock and validate round
      const round = await manager
        .createQueryBuilder(Round, 'round')
        .setLock('pessimistic_write')
        .where('round.id = :roundId', { roundId })
        .getOne();

      if (round.status !== 'BETTING') {
        throw new BadRequestException('Round already completed');
      }

      // Step 2: Mark losing bets (bulk update - fast)
      await manager
        .createQueryBuilder()
        .update(Bet)
        .set({ status: 'LOST', settledAt: () => 'NOW()' })
        .where('roundId = :roundId', { roundId })
        .andWhere('choice != :winner', { winner })
        .execute();

      // Step 3: Get winning bets (ordered to prevent deadlock)
      const winningBets = await manager.find(Bet, {
        where: { roundId, choice: winner },
        order: { userId: 'ASC' }
      });

      // Step 4: Process each payout
      for (const bet of winningBets) {
        await manager.increment(Wallet, { userId: bet.userId }, 'balance', bet.potentialPayout);
        await manager.update(Bet, { id: bet.id }, { status: 'WON' });
      }

      // Step 5: Update round status
      await manager.update(Round, { id: roundId }, {
        status: 'COMPLETED',
        completedAt: new Date()
      });
    });
  }
}
```

---

## 4.2 Caching Strategy (Avoid N+1 at scale)

```typescript
@Injectable()
export class CacheService {
  constructor(private cacheManager: CacheManager) {}

  async getLeaderboard(): Promise<Leaderboard[]> {
    const cacheKey = 'leaderboard:top100';

    // Try cache (1ms)
    const cached = await this.cacheManager.get<Leaderboard[]>(cacheKey);
    if (cached) return cached;

    // Query database (2000ms)
    const leaderboard = await this.getLeaderboardFromDB();

    // Cache for 5 minutes
    await this.cacheManager.set(cacheKey, leaderboard, 300000);

    return leaderboard;
  }

  async updateUserProfile(userId: number, data: any): Promise<User> {
    const user = await this.userRepo.update(userId, data);

    // Invalidate caches
    await this.cacheManager.del(`user:${userId}`);
    await this.cacheManager.del('leaderboard:top100');

    return user;
  }

  private async getLeaderboardFromDB(): Promise<Leaderboard[]> {
    return userRepository
      .createQueryBuilder('user')
      .leftJoin('user.bets', 'bet')
      .select('user.id', 'userId')
      .addSelect('user.username', 'username')
      .addSelect('SUM(CASE WHEN bet.status = \'WON\' THEN bet.actualPayout ELSE 0 END)', 'totalWon')
      .addSelect('SUM(CASE WHEN bet.status = \'LOST\' THEN bet.amount ELSE 0 END)', 'totalLost')
      .groupBy('user.id, user.username')
      .orderBy(
        'SUM(CASE WHEN bet.status = \'WON\' THEN bet.actualPayout ELSE 0 END) - SUM(CASE WHEN bet.status = \'LOST\' THEN bet.amount ELSE 0 END)',
        'DESC'
      )
      .limit(100)
      .getRawMany();
  }
}
```

---

# 🏗️ Qreformátus SCALING & ARCHITECTURE

## Nguyên Tắc Thiết Kế (Design Principles)

### 1. SOLID Principles

#### S - Single Responsibility Principle
```typescript
// ❌ BAD: 1 class làm nhiều việc
class UserService {
  async createUser(data) { /* ... */ }
  async sendEmail(email) { /* ... */ }
  async hashPassword(password) { /* ... */ }
  async validateSSN(ssn) { /* ... */ }
}

// ✅ GOOD: Mỗi class 1 trách nhiệm
class UserService {
  async createUser(data) { /* ... */ }
}
class EmailService {
  async send(email, template) { /* ... */ }
}
class HashService {
  async hash(password) { /* ... */ }
}
class ValidationService {
  async validateSSN(ssn) { /* ... */ }
}
```
**Rule:** Nếu describe class cần "and", đó là dấu hiệu cần tách.

---

#### O - Open/Closed Principle
```typescript
// ❌ BAD: Thêm rule, sửa code cũ
if (userType === 'ADMIN') {
  // ...
} else if (userType === 'MEMBER') {
  // ...
} else if (userType === 'VIP') {
  // ...
}

// ✅ GOOD: Extend without modifying
interface UserRole {
  hasPermission(action: string): boolean;
  getQuota(): number;
}

class AdminRole implements UserRole {
  hasPermission(action: string) { return true; }
  getQuota() { return Infinity; }
}

class MemberRole implements UserRole {
  hasPermission(action: string) { return checkPermissions(action); }
  getQuota() { return 100; }
}

// New role? Just add new class, không sửa code cũ
```
**Rule:** Nếu thêm feature mà sửa code cũ, design sai.

---

#### L - Liskov Substitution Principle
```typescript
// ❌ BAD: Subclass không follow contract
abstract class Repository<T> {
  async find(id: number): Promise<T | null> { /* ... */ }
}

class CachedRepository extends Repository {
  async find(id: number): Promise<T | null> {
    // Exception: return null nếu cache miss
    // Violates contract!
  }
}

// ✅ GOOD: Subclass respects contract
class CachedRepository extends Repository {
  async find(id: number): Promise<T | null> {
    if (cache.has(id)) return cache.get(id);
    const data = await super.find(id);
    cache.set(id, data); // Enhancement, không breaking
    return data;
  }
}
```
**Rule:** If you need `instanceof` check, LSP violated.

---

#### I - Interface Segregation Principle
```typescript
// ❌ BAD: Fat interface
interface Repository<T> {
  find(id: number): Promise<T>;
  findAll(): Promise<T[]>;
  create(data: Partial<T>): Promise<T>;
  update(id: number, data: Partial<T>): Promise<T>;
  delete(id: number): Promise<void>;
  findByEmail(email: string): Promise<T>;
  findByPhone(phone: string): Promise<T>;
}

// ✅ GOOD: Small, focused interfaces
interface ReadRepository<T> {
  find(id: number): Promise<T>;
  findAll(): Promise<T[]>;
}

interface WriteRepository<T> {
  create(data: Partial<T>): Promise<T>;
  update(id: number, data: Partial<T>): Promise<T>;
  delete(id: number): Promise<void>;
}

interface SearchRepository<T> {
  findByEmail(email: string): Promise<T>;
  findByPhone(phone: string): Promise<T>;
}

// Use only what you need
class ReadOnlyService {
  constructor(private repo: ReadRepository<User>) {}
}
```
**Rule:** Interfaces should be small enough to implement fully.

---

#### D - Dependency Inversion Principle
```typescript
// ❌ BAD: Depend on concrete classes
class BetService {
  private db = new PostgresDatabase(); // Concrete
  
  async placeBet(dto) {
    return this.db.save(/* ... */);
  }
}

// ✅ GOOD: Depend on abstractions
interface Database {
  save<T>(entity: T): Promise<T>;
  find<T>(id: number): Promise<T>;
}

class BetService {
  constructor(private db: Database) {} // Abstract
  
  async placeBet(dto) {
    return this.db.save(/* ... */);
  }
}

// Can inject any Database implementation
const betService = new BetService(new PostgresDatabase());
const betServiceTest = new BetService(new MockDatabase());
```
**Rule:** Inject interfaces, not implementations.

---

### 2. DRY Principle (Don't Repeat Yourself)

```typescript
// ❌ SAI: Repeated validation logic
@Post('bets')
async placeBet(@Body() dto: PlaceBetDto) {
  if (!dto.amount) throw new BadRequestException('Amount required');
  if (dto.amount < 1000) throw new BadRequestException('Min 1000');
  if (dto.amount > 1000000) throw new BadRequestException('Max 1000000');
  // ... more code
}

@Post('refund')
async refund(@Body() dto: RefundDto) {
  if (!dto.amount) throw new BadRequestException('Amount required');
  if (dto.amount < 1000) throw new BadRequestException('Min 1000');
  if (dto.amount > 1000000) throw new BadRequestException('Max 1000000');
  // ... more code
}

// ✅ ĐÚNG: Extract to reusable validator
export class ValidateAmount {
  @IsNumber()
  @Min(1000)
  @Max(1000000)
  amount: number;
}

@Post('bets')
@UsePipes(ValidationPipe)
async placeBet(@Body() dto: PlaceBetDto & ValidateAmount) {
  // Validation automatic
}

@Post('refund')
@UsePipes(ValidationPipe)
async refund(@Body() dto: RefundDto & ValidateAmount) {
  // Validation automatic
}
```

---

### 3. KISS Principle (Keep It Simple, Stupid)

```typescript
// ❌ SAI: Over-engineered
class ComplexCalculator {
  private readonly MULTIPLIER = 2;
  private readonly DIVISOR = 1;
  
  calculate(a: number, b: number): number {
    return (a * this.MULTIPLIER + b * this.DIVISOR) / 
           (this.MULTIPLIER + this.DIVISOR);
  }
}

// ✅ ĐÚNG: Simple
function calculateAverage(a: number, b: number): number {
  return (a + b) / 2;
}
```
**Rule:** Simple > Complex. If you need to comment, maybe too complex.

---

## Database Design Rules

### Rule 1: Normalize, Then Denormalize by Metrics
```sql
-- ✅ Good: Normalized
CREATE TABLE users (id INT PRIMARY KEY);
CREATE TABLE wallets (id INT, user_id INT REFERENCES users, balance DECIMAL);
CREATE TABLE transactions (id INT, wallet_id INT REFERENCES wallets, amount DECIMAL);

-- For 100k+ users, add denormalized column for fast queries
ALTER TABLE users ADD COLUMN current_balance DECIMAL;
-- Sync with trigger:
CREATE TRIGGER update_user_balance AFTER INSERT ON transactions
  FOR EACH ROW UPDATE users SET current_balance = current_balance + NEW.amount WHERE id = NEW.user_id;
```

---

### Rule 2: Partition Large Tables
```sql
-- ✅ Partition by time (for logs/transactions)
CREATE TABLE transactions_2024 PARTITION OF transactions
  FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

-- ✅ Partition by user_id (for scalability)
CREATE TABLE bets_shard_0 PARTITION OF bets
  FOR VALUES WITH (MODULUS 10, REMAINDER 0);
CREATE TABLE bets_shard_1 PARTITION OF bets
  FOR VALUES WITH (MODULUS 10, REMAINDER 1);
```

---

### Rule 3: Index Strategy
```sql
-- ✅ Index hot queries
CREATE INDEX idx_bets_user_round ON bets(user_id, round_id);
CREATE INDEX idx_bets_status ON bets(status) WHERE status = 'PENDING';

-- ✅ Covering index (includes data, avoid table scan)
CREATE INDEX idx_bets_covering ON bets(user_id, round_id) INCLUDE (amount, odds);

-- ❌ DON'T: Index everything
-- Each index = slower writes + more storage
```

---

### Rule 4: Primary Key Strategy
```typescript
// ❌ BAD: UUID (16 bytes) for everything
@PrimaryGeneratedColumn('uuid')
id: string;

// ✅ GOOD: INT for internal, UUID for API
@PrimaryGeneratedColumn()
id: number; // 4 bytes, auto-increment, fast

@Column({ unique: true })
publicId: string; // UUID for external reference
```

---

## API Design Rules

### Rule 1: Versioning
```typescript
// ❌ BAD: No versioning
@Controller('api/bets')
export class BetController {}

// ✅ GOOD: Version in URL
@Controller('api/v1/bets')
export class BetControllerV1 {}

@Controller('api/v2/bets')
export class BetControllerV2 {}

// OR: Accept version header
@Controller('api/bets')
export class BetController {
  @Get()
  @Header('API-Version', '1.0')
  getBets() { /* ... */ }
}
```

---

### Rule 2: Pagination
```typescript
// ❌ BAD: No limit
@Get('/bets')
async getBets() {
  return betRepository.find(); // 1M rows!
}

// ✅ GOOD: Pagination
@Get('/bets')
async getBets(@Query('page', DefaultValuePipe) page = 1, @Query('limit', DefaultValuePipe) limit = 20) {
  return betRepository.find({
    skip: (page - 1) * limit,
    take: limit,
    order: { createdAt: 'DESC' }
  });
}

// Response includes metadata
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5000,
    "pages": 250
  }
}
```

---

### Rule 3: Filtering & Sorting
```typescript
// ✅ GOOD: Flexible filtering
@Get('/bets')
async getBets(@Query() filter: BetFilterDto) {
  // filter.status = 'PENDING'
  // filter.minAmount = 10000
  // filter.sortBy = 'amount' / 'createdAt'
  // filter.order = 'ASC' / 'DESC'
  
  const query = betRepository.createQueryBuilder('bet');
  
  if (filter.status) query.andWhere('bet.status = :status', { status: filter.status });
  if (filter.minAmount) query.andWhere('bet.amount >= :minAmount', { minAmount: filter.minAmount });
  
  query.orderBy(`bet.${filter.sortBy}`, filter.order);
  
  return query.getMany();
}

// Usage: GET /api/v1/bets?status=PENDING&minAmount=10000&sortBy=amount&order=DESC
```

---

## Caching Strategy Rules

### Rule 1: Cache Levels
```typescript
// Level 1: In-Memory Cache (fast, small)
class CacheService {
  private memory = new Map(); // Good for: user profiles, leaderboard
}

// Level 2: Redis Cache (medium speed, medium size)
this.redis.get('key'); // Good for: recent bets, user stats

// Level 3: Database Query Cache (slow, large)
// (Materialized views in Postgres)
```

---

### Rule 2: Cache Invalidation Strategy
```typescript
// ❌ NAIVE: Cache everything with 1 hour TTL
// → Stale data for 1 hour

// ✅ SMART: TTL based on change frequency
- User profile: 1 hour (changes rarely)
- User balance: 5 minutes (changes often)
- Leaderboard: 1 minute (changes every second)
- Search results: 30 seconds (changes often)

// ✅ SMARTER: Event-based invalidation
async updateUserBalance(userId: number, delta: number) {
  // Update database
  // Invalidate cache
  await cache.del(`user:${userId}:balance`);
  await cache.del('leaderboard:top100'); // might change
}
```

---

## Monitoring & Observability Rules

### Rule 1: Log Levels
```typescript
// 🔴 ERROR: Failures that need immediate action
logger.error('Database connection failed', { error, context });

// 🟡 WARN: Potential issues
logger.warn('High memory usage', { memory: 80 });

// 🟢 INFO: Important business events
logger.info('User registered', { userId, referralCode });

// 🔵 DEBUG: Development info
logger.debug('Query execution time', { query, ms: 150 });

// ⚫ TRACE: Very detailed (disabled in production)
logger.trace('Variable value', { variable });

// ❌ DON'T: Log everything at ERROR level
// ❌ DON'T: Log passwords, tokens, sensitive data
```

---

### Rule 2: Metrics to Track
```typescript
// 📊 Business metrics
- Active users
- Transactions per second
- Bet win rate
- Average payout
- User retention

// ⚡ Performance metrics
- API response time (p50, p95, p99)
- Database query time
- Cache hit rate
- Worker queue depth

// 🔒 Reliability metrics
- Error rate
- Failed transactions
- Duplicate payouts
- Transaction settlement time

// Setup with Prometheus + Grafana
```

---

## Testing Strategy Rules

### Rule 1: Test Pyramid
```
         /\
        /  \  E2E Tests (10%)
       /____\
      /      \
     / Integ. \ Integration Tests (30%)
    /_________\
   /           \
  / Unit Tests  \ Unit Tests (60%)
 /_______________\
```

**Rule:** 60% unit, 30% integration, 10% E2E

---

### Rule 2: Test Cases to Write
```typescript
// ✅ Happy path
it('should place bet when valid', async () => {
  const result = await service.placeBet(validDto, userId);
  expect(result.status).toBe('PENDING');
});

// ✅ Error cases
it('should throw when insufficient balance', async () => {
  expect(() => service.placeBet(dto, poorUserId)).toThrow(InsufficientBalanceError);
});

// ✅ Edge cases
it('should handle race condition with locking', async () => {
  // 2 concurrent requests, only 1 succeeds
});

// ✅ Integration
it('should update wallet balance after bet', async () => {
  await service.placeBet(dto, userId);
  const wallet = await walletRepo.findById(userId);
  expect(wallet.balance).toBe(originalBalance - amount);
});
```

---

## Deployment Rules

### Rule 1: Blue-Green Deployment
```
Production (Blue - Current)
├─ 100% traffic
├─ Stable version v1.0

Staging (Green - New)
├─ 0% traffic
├─ New version v1.1
├─ Run tests
├─ Monitor metrics

If Green OK:
  Switch traffic: 0% → 100%
  If issues: Quick rollback to Blue
```

---

### Rule 2: Rollout Strategy
```
Canary Release (Gradual rollout)

Time 0:     v1.0: 100%
Time 5min:  v1.0: 95%, v1.1: 5%   (Monitor errors)
Time 15min: v1.0: 75%, v1.1: 25%  (Monitor errors)
Time 30min: v1.0: 50%, v1.1: 50%  (Monitor errors)
Time 60min: v1.0: 0%,  v1.1: 100% (Complete)

If error rate spike: Rollback v1.1 immediately
```

---

### Rule 3: Database Migration Strategy
```typescript
// ✅ GOOD: Backward compatible migrations
// V1: existing code expects users.username
// Add: users.fullName nullable column

// New code:
async getFullName(userId) {
  const user = await userRepo.find(userId);
  return user.fullName || user.username; // fallback
}

// No downtime, no breaking change

// ❌ BAD: Breaking migrations
// V1: users.username
// V2: ALTER TABLE users DROP COLUMN username;
// → Old code crashes! Downtime!
```

---

## Team Collaboration Rules

### Rule 1: Code Review Checklist
```
[ ] Logic is correct
[ ] No security issues (SQL injection, XSS, CSRF)
[ ] Error handling complete
[ ] Tests written (unit + integration)
[ ] Performance acceptable (no N+1, no huge loads)
[ ] Documentation updated
[ ] Follows team conventions
[ ] No hardcoded values (use config)
[ ] Logs added for debugging
```

---

### Rule 2: Git Workflow
```
main (production ready)
├─ feature/user-registration (dev branch)
├─ feature/bet-matching (dev branch)
└─ hotfix/security-patch (hotfix branch)

Flow:
1. Create branch from main
2. Push to feature/xxx
3. Create Pull Request
4. Code review (at least 1 approval)
5. Merge to main
6. Auto-deploy to staging
7. Manual approval to production
```

---

### Rule 3: Commit Message Format
```
❌ Bad:
  "fix bug"
  "update code"
  "asdf"

✅ Good:
  "feat(auth): add email verification"
  "fix(bet): prevent race condition in auto-match"
  "refactor(db): optimize user query with indexes"
  "docs(readme): add deployment guide"

Format:
  type(scope): subject
  
  body (optional)
  
  - type: feat, fix, refactor, docs, test, chore, perf
  - scope: module affected
  - subject: what changed
```

---

# 📋 Anti-Patterns Quick Reference

| ❌ Anti-Pattern | 🔴 Problem | ✅ Solution |
|-----------------|-----------|------------|
| No input validation | SQL injection, crashes | Use DTO + ValidationPipe |
| Return all fields | Sensitive data exposed | Use ResponseDto |
| Everything in controller | Hard to test/reuse | Move logic to service |
| No error handling | Client confused | Throw specific exceptions |
| Load all data | Memory issues | Load only needed data |
| Filter in memory | Slow, resource-heavy | Filter in database |
| N+1 queries | Database overload | Use JOIN/relations |
| No transaction | Data inconsistency | Use transaction |
| No locking | Race conditions | Use pessimistic lock |
| No caching | Database bottleneck | Cache with TTL |

---

# 🎯 Checklist Sebelum Push Code

- [ ] ✅ Input validated (DTO + ValidationPipe)
- [ ] ✅ Error handling (throw exceptions)
- [ ] ✅ Sensitive data excluded (ResponseDto)
- [ ] ✅ Code organized (Entity → DTO → Repo → Service → Controller)
- [ ] ✅ Business logic in service (not controller)
- [ ] ✅ No N+1 queries (checked with logs)
- [ ] ✅ No unnecessary data loaded
- [ ] ✅ Financial operations in transaction
- [ ] ✅ Race conditions prevented (locking)
- [ ] ✅ Unit tests written
- [ ] ✅ Integration tests written
- [ ] ✅ Load tested (1000+ users)
- [ ] ✅ Code reviewed

---

*Tất cả examples được lấy từ betting API project. Copy-paste vào project của bạn!*

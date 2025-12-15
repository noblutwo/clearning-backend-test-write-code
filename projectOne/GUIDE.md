# Hướng dẫn triển khai Elysia Backend với PostgreSQL & TypeORM

## 📋 Mục lục

1. [Giới thiệu](#giới-thiệu)
2. [Cài đặt ban đầu](#cài-đặt-ban-đầu)
3. [Cấu trúc dự án](#cấu-trúc-dự-án)
4. [Quản lý cơ sở dữ liệu](#quản-lý-cơ-sở-dữ-liệu)
5. [Phát triển API](#phát-triển-api)
6. [Triển khai](#triển-khai)

## 🎯 Giới thiệu

Đây là một backend chuyên nghiệp xây dựng với:
- **Bun** - JavaScript runtime siêu nhanh
- **Elysia** - Framework web hiện đại
- **PostgreSQL** - Cơ sở dữ liệu quan hệ
- **TypeORM** - ORM mạnh mẽ

## 🚀 Cài đặt ban đầu

### Yêu cầu
- Bun >= 1.0.0
- PostgreSQL >= 14
- Git

### Bước 1: Clone và cài đặt
```bash
# Clone repository
git clone <repository-url>
cd projectOne

# Cài đặt dependencies
bun install
```

### Bước 2: Cấu hình cơ sở dữ liệu

**Option A: Dùng Docker (Khuyến khích)**
```bash
# Khởi động PostgreSQL container
docker-compose up -d

# Kiểm tra kết nối
docker-compose ps
```

**Option B: Dùng PostgreSQL cục bộ**
```bash
# Tạo database
createdb elysia_db

# Cập nhật .env với thông tin kết nối
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=elysia_db
```

### Bước 3: Chạy migrations
```bash
# Chạy migrations
bun typeorm migration:run -d src/database/connection.ts
```

## 📁 Cấu trúc dự án

```
src/
├── config/                 # Cấu hình ứng dụng
│   ├── env.ts             # Biến môi trường
│   └── constants.ts       # Hằng số
├── database/              # Lớp cơ sở dữ liệu
│   ├── connection.ts      # Kết nối TypeORM
│   ├── entities/          # Các entity
│   │   └── user.entity.ts
│   └── migrations/        # Migrations
├── controllers/           # Xử lý HTTP requests
│   └── health.controller.ts
├── services/              # Logic nghiệp vụ
│   └── user.service.ts
├── repositories/          # Data Access Layer
│   └── user.repository.ts
├── dtos/                  # Data Transfer Objects
│   └── user.dto.ts
├── middleware/            # Middleware
│   ├── error.middleware.ts
│   ├── logger.middleware.ts
│   └── cors.middleware.ts
├── utils/                 # Hàm tiện ích
│   ├── logger.ts
│   └── helpers.ts
├── types/                 # TypeScript types
│   ├── api.types.ts
│   └── response.types.ts
├── routes/                # API routes
│   ├── index.ts
│   └── v1/
│       ├── health.routes.ts
│       └── users.routes.ts
└── index.ts              # Entry point
```

## 🗄️ Quản lý cơ sở dữ liệu

### Tạo Entity mới

**Ví dụ: Tạo Post entity**

1. Tạo file `src/database/entities/post.entity.ts`:
```typescript
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { User } from './user.entity';

@Entity('posts')
export class Post {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar')
  title: string;

  @Column('text')
  content: string;

  @ManyToOne(() => User, (user) => user.posts, { onDelete: 'CASCADE' })
  author: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

2. Tạo migration:
```bash
bun typeorm migration:generate -d src/database/connection.ts \
  src/database/migrations/CreatePostTable
```

3. Chạy migration:
```bash
bun typeorm migration:run -d src/database/connection.ts
```

### Queries thường dùng

```typescript
// Tìm tất cả
const users = await userRepository.find();

// Tìm với điều kiện
const user = await userRepository.findOne({
  where: { email: 'user@example.com' }
});

// Tìm với relation
const user = await userRepository.findOne({
  where: { id },
  relations: ['posts']
});

// Query builder
const users = await userRepository
  .createQueryBuilder('user')
  .where('user.status = :status', { status: 'active' })
  .orderBy('user.createdAt', 'DESC')
  .getMany();
```

## 🔨 Phát triển API

### Thêm endpoint mới

**Bước 1: Tạo Controller**
```typescript
// src/controllers/post.controller.ts
export class PostController {
  static async getAll() {
    try {
      const posts = await PostService.getAllPosts();
      return {
        status: 200,
        body: { success: true, data: posts }
      };
    } catch (error) {
      return {
        status: 500,
        body: { success: false, error: 'Failed to fetch posts' }
      };
    }
  }
}
```

**Bước 2: Tạo Service**
```typescript
// src/services/post.service.ts
export class PostService {
  static async getAllPosts() {
    const postRepository = AppDataSource.getRepository(Post);
    return await postRepository.find({ relations: ['author'] });
  }
}
```

**Bước 3: Tạo Routes**
```typescript
// src/routes/v1/posts.routes.ts
export const postRoutes = new Elysia({ prefix: '/api/v1/posts' })
  .get('/', () => PostController.getAll())
  .post('/', (body) => PostController.create(body), {
    body: t.Object({
      title: t.String(),
      content: t.String(),
      authorId: t.String(),
    })
  });
```

**Bước 4: Đăng ký Routes**
```typescript
// src/routes/index.ts
export const routes = new Elysia()
  .use(healthRoutes)
  .use(userRoutes)
  .use(postRoutes);  // Thêm dòng này
```

## 🚀 Triển khai

### Triển khai với Docker

```bash
# Build image
docker build -t elysia-backend .

# Chạy container
docker run -p 3000:3000 \
  -e DB_HOST=postgres \
  -e DB_USER=postgres \
  -e DB_PASSWORD=postgres \
  -e DB_NAME=elysia_db \
  elysia-backend
```

### Triển khai với Docker Compose

```bash
# Build và chạy
docker-compose up -d

# Xem logs
docker-compose logs -f app

# Dừng
docker-compose down
```

### Triển khai trực tiếp (không Docker)

```bash
# Build
bun run build

# Chạy
PORT=3000 NODE_ENV=production bun dist/index.js
```

## 📊 Monitoring và Logging

### Xem logs
```bash
# Development
bun run dev

# Logs tự động xuất ra trong quá trình chạy
```

### Health check
```bash
curl http://localhost:3000/health
```

## 🧪 Testing

```bash
# Tạo test file
touch src/tests/user.test.ts

# Chạy tests
bun test

# Chạy test cụ thể
bun test src/tests/user.test.ts
```

## 📝 Best Practices

1. **Validation** - Luôn validate input từ client
2. **Error Handling** - Sử dụng try-catch và error middleware
3. **Logging** - Log các action quan trọng
4. **Migrations** - Luôn tạo migration khi thay đổi schema
5. **Soft Delete** - Dùng soft delete thay vì xóa hoàn toàn
6. **DTOs** - Tách biệt DTO với Entity
7. **Repositories** - Dùng Repository pattern cho data access

## 🔐 Bảo mật

### Biến môi trường
- Không commit `.env` file
- Dùng `.env.example` cho reference
- Khác biệt `.env` giữa dev, test, production

### Database
- Backup thường xuyên
- Sử dụng connection pooling
- Validate queries

### API
- Validate input
- Rate limiting
- CORS configuration
- Authentication/Authorization

## 📚 Tài liệu tham khảo

- [Elysia Docs](https://elysiajs.com)
- [Bun Docs](https://bun.sh/docs)
- [TypeORM Docs](https://typeorm.io)
- [PostgreSQL Docs](https://www.postgresql.org/docs)

## ❓ Troubleshooting

### Lỗi kết nối database
```bash
# Kiểm tra PostgreSQL đang chạy
docker-compose ps

# Kiểm tra logs
docker-compose logs postgres
```

### Lỗi migration
```bash
# Xem migration status
bun typeorm migration:show -d src/database/connection.ts

# Revert migration cuối cùng
bun typeorm migration:revert -d src/database/connection.ts
```

### Lỗi TypeScript
```bash
# Type checking
bun run type-check

# Xem lỗi chi tiết
bunx tsc --noEmit
```

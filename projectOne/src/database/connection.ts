// import 'reflect-metadata';
// import { DataSource } from 'typeorm';
// import { config } from '@/config/env';
// import { User } from './entities/user.entity';
// import { Post } from './entities/post.entity';

// export const AppDataSource = new DataSource({
//   type: 'postgres',
//   host: Bun.env.DB_HOST || 'localhost',
//   port: Bun.env.DB_PORT ? parseInt(Bun.env.DB_PORT) : 5432,
//   username: Bun.env.DB_USER || 'postgres',
//   password: Bun.env.DB_PASSWORD || 'postgres',
//   database: Bun.env.DB_NAME || 'elysia_db',
//   synchronize: config.isDevelopment,
//   logging: config.isDevelopment,
//   entities: [User, Post],
//   migrations: ['src/database/migrations/**/*.ts'],
//   subscribers: [],
// });

// export async function initializeDatabase() {
//   try {
//     await AppDataSource.initialize();
//     console.log('✅ Database connection established');
//   } catch (error) {
//     console.error('❌ Error during Data Source initialization:', error);
//     process.exit(1);
//   }
// }
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from '@/config/env';
import { User } from './entities/user.entity';
import { Post } from './entities/post.entity';

/**
 * SQLite Database Configuration
 * No installation required - database runs as a local file
 * Perfect for development & testing
 */
export const AppDataSource = new DataSource({
  type: 'sqlite',
  database: Bun.env.DB_NAME || './data/elysia_db.sqlite',
  synchronize: config.isDevelopment,
  logging: config.isDevelopment,
  entities: [User, Post],
  migrations: ['src/database/migrations/**/*.ts'],
  subscribers: [],
});

export async function initializeDatabase() {
  try {
    await AppDataSource.initialize();
    console.log('✅ Database connection established');
  } catch (error) {
    console.error('❌ Error during Data Source initialization:', error);
    process.exit(1);
  }
}

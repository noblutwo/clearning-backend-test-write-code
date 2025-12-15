import { Repository, IsNull, FindOptionsWhere, DeepPartial } from 'typeorm';
export abstract class BaseRepository<Entity extends { id: string; deletedAt?: Date | null }> {
  constructor(protected readonly repository: Repository<Entity>) {}
  async findAll(): Promise<Entity[]> {
    return await this.repository.find({
      where: { deletedAt: IsNull() } as FindOptionsWhere<Entity>,
      order: { createdAt: 'DESC' } as any,
    });
  }
  async findById(id: string): Promise<Entity | null> {
    return await this.repository.findOne({
      where: { id, deletedAt: IsNull() } as FindOptionsWhere<Entity>,
    });
  }
  async create(data: DeepPartial<Entity>): Promise<Entity> {
    const entity = this.repository.create(data);
    return await this.repository.save(entity);
  }

  async update(id: string, data: DeepPartial<Entity>): Promise<Entity | null> {
    await this.repository.update(id, data as any);
    return await this.findById(id);
  }

  async softDelete(id: string): Promise<Entity | null> {
    const entity = await this.findById(id);
    if (!entity) {
      return null;
    }

    (entity as any).deletedAt = new Date();
    return await this.repository.save(entity);
  }

  async hardDelete(id: string) {
    return await this.repository.delete(id);
  }

  async findByCondition(where: FindOptionsWhere<Entity>): Promise<Entity[]> {
    return await this.repository.find({
      where,
      order: { createdAt: 'DESC' } as any,
    });
  }

  async findOneByCondition(where: FindOptionsWhere<Entity>): Promise<Entity | null> {
    return await this.repository.findOne({ where });
  }
  async count(): Promise<number> {
    return await this.repository.count({
      where: { deletedAt: IsNull() } as FindOptionsWhere<Entity>,
    });
  }

  async exists(id: string): Promise<boolean> {
    const entity = await this.findById(id);
    return entity !== null;
  }

  async findPaginated(page: number, limit: number): Promise<[Entity[], number]> {
    const skip = (page - 1) * limit;

    const [entities, total] = await this.repository.findAndCount({
      where: { deletedAt: IsNull() } as FindOptionsWhere<Entity>,
      skip,
      take: limit,
      order: { createdAt: 'DESC' } as any,
    });

    return [entities, total];
  }

  getRepository(): Repository<Entity> {
    return this.repository;
  }
}

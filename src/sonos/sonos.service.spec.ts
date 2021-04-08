import { Test, TestingModule } from '@nestjs/testing';
import { SonosService } from './sonos.service';

describe('SonosService', () => {
  let service: SonosService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SonosService],
    }).compile();

    service = module.get<SonosService>(SonosService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

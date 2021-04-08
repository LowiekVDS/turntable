import { Test, TestingModule } from '@nestjs/testing';
import { SonosController } from './sonos.controller';

describe('SonosController', () => {
  let controller: SonosController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SonosController],
    }).compile();

    controller = module.get<SonosController>(SonosController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

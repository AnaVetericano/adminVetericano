import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CrearPa } from './crear-pa';

describe('CrearPa', () => {
  let component: CrearPa;
  let fixture: ComponentFixture<CrearPa>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CrearPa],
    }).compileComponents();

    fixture = TestBed.createComponent(CrearPa);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

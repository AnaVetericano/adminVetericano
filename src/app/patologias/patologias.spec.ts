import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Patologias } from './patologias';

describe('Patologias', () => {
  let component: Patologias;
  let fixture: ComponentFixture<Patologias>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Patologias]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Patologias);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

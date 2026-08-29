import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Landepage } from './landepage';

describe('Landepage', () => {
  let component: Landepage;
  let fixture: ComponentFixture<Landepage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Landepage],
    }).compileComponents();

    fixture = TestBed.createComponent(Landepage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

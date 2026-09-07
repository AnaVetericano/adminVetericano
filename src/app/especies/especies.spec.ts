import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Especies } from './especies';

describe('Especies', () => {
  let component: Especies;
  let fixture: ComponentFixture<Especies>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Especies],
    }).compileComponents();

    fixture = TestBed.createComponent(Especies);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { Compra } from './compra';

describe('Compra', () => {
  let component: Compra;
  let fixture: ComponentFixture<Compra>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Compra],
      providers: [provideHttpClient()]
    }).compileComponents();

    fixture = TestBed.createComponent(Compra);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

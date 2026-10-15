import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { ExamenesClinicos } from './examenes-clinicos';

describe('ExamenesClinicos', () => {
  let component: ExamenesClinicos;
  let fixture: ComponentFixture<ExamenesClinicos>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExamenesClinicos],
      providers: [
        provideHttpClient(),
        provideRouter([])
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ExamenesClinicos);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

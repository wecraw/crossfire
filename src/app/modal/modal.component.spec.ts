import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AppModule } from '../app.module';
import { ModalComponent } from './modal.component';

describe('ModalComponent', () => {
  let component: ModalComponent;
  let fixture: ComponentFixture<ModalComponent>;

  beforeEach(async () => {
    // ModalComponent is declared in AppModule alongside the child components its
    // template depends on, so importing the module gives the compiler the
    // full context it needs.
    await TestBed.configureTestingModule({
      imports: [AppModule],
    }).compileComponents();

    fixture = TestBed.createComponent(ModalComponent);
    component = fixture.componentInstance;
    // The stats template iterates over per-level data, so provide the inputs
    // the template reads before rendering.
    component.incorrectGuessesByLevel = [0, 0, 0, 0, 0, 0, 0];
    component.currentLevel = 0;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows the backend rank, or top 25% for the day\'s first player', () => {
    component.dailyRank = { total: 1342, topPercent: 12 };
    expect(component.rankPercent).toBe(12);

    component.dailyRank = { total: 1, topPercent: 100 };
    expect(component.rankPercent).toBe(25);
  });

  it('clears its countdown interval when destroyed', () => {
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');

    component.ngOnDestroy();

    expect(clearIntervalSpy).toHaveBeenCalledWith(component.interval);
    clearIntervalSpy.mockRestore();
  });
});

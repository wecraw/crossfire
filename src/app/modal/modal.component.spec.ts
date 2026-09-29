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

  it('shows the backend rank, or top 50% for the day\'s first player', () => {
    component.dailyRank = { total: 1342, topPercent: 12 };
    expect(component.rankPercent).toBe(12);

    component.dailyRank = { total: 1, topPercent: 100 };
    expect(component.rankPercent).toBe(50);
  });

  it('disables the primary (Share) button while the rank is loading', () => {
    component.decisionModal = true;
    const button = () =>
      fixture.nativeElement.querySelector('.btn-primary') as HTMLButtonElement;

    component.rankLoading = true;
    fixture.detectChanges();
    expect(button().disabled).toBe(true);

    component.rankLoading = false;
    fixture.detectChanges();
    expect(button().disabled).toBe(false);
  });

  it('slides pages in the direction of travel and wraps the arrows', () => {
    component.replays = new Array(7);
    expect(component.animated).toBe(false);

    component.goToPage(3);
    expect(component.currentPage).toBe(3);
    expect(component.leavingPage).toBe(0);
    expect(component.direction).toBe('forward');
    expect(component.animated).toBe(true);

    component.goToPage(0);
    expect(component.leavingPage).toBe(3);
    expect(component.direction).toBe('back');

    //the left arrow from the summary wraps to the last replay, still sliding back
    component.prevPage();
    expect(component.currentPage).toBe(7);
    expect(component.direction).toBe('back');

    component.nextPage();
    expect(component.currentPage).toBe(0);
    expect(component.direction).toBe('forward');

    //re-selecting the current page is a no-op
    component.goToPage(0);
    expect(component.leavingPage).toBe(7);
  });

  it('clears its countdown interval when destroyed', () => {
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');

    component.ngOnDestroy();

    expect(clearIntervalSpy).toHaveBeenCalledWith(component.interval);
    clearIntervalSpy.mockRestore();
  });
});

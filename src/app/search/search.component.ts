import { Component, OnInit } from '@angular/core';
import algoliasearch from 'algoliasearch/lite';

const searchClient = algoliasearch(
  'LCMIOI0I7W',
  'd7a3796218b0aca6ef7dea1ca3ed3b1e'
);

@Component({
  selector: 'app-search',
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.scss']
})
export class SearchComponent implements OnInit {

  showAnswerIndex = -1;
  flipBack = false;

  config = {
    indexName: 'crossword-index',
    searchClient
  };

  constructor() { }

  ngOnInit(): void {
  }

  showAnswer(index: number){
    this.showAnswerIndex = index;
  }

  hideAnswer(index: number){
    let that = this
    this.showAnswerIndex = -1
    this.flipBack = true;
    setTimeout(function(){
      that.flipBack = false;
    }, 400);
  }

}

export namespace time {
	
	export class Time {
	
	
	    static createFrom(source: any = {}) {
	        return new Time(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	
	    }
	}

}

export namespace tracker {
	
	export class AppState {
	    CurrentTaskID?: number;
	    CurrentProjectID?: number;
	    TrackingPaused: boolean;
	    AFKThresholdMinutes: number;
	
	    static createFrom(source: any = {}) {
	        return new AppState(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.CurrentTaskID = source["CurrentTaskID"];
	        this.CurrentProjectID = source["CurrentProjectID"];
	        this.TrackingPaused = source["TrackingPaused"];
	        this.AFKThresholdMinutes = source["AFKThresholdMinutes"];
	    }
	}
	export class Block {
	    ID: number;
	    StartTime: time.Time;
	    EndTime: time.Time;
	    AppName: string;
	    WindowTitle: string;
	    TaskID?: number;
	    ProjectID?: number;
	
	    static createFrom(source: any = {}) {
	        return new Block(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ID = source["ID"];
	        this.StartTime = this.convertValues(source["StartTime"], time.Time);
	        this.EndTime = this.convertValues(source["EndTime"], time.Time);
	        this.AppName = source["AppName"];
	        this.WindowTitle = source["WindowTitle"];
	        this.TaskID = source["TaskID"];
	        this.ProjectID = source["ProjectID"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Project {
	    ID: number;
	    Name: string;
	    Color: string;
	    EstimateMinutes?: number;
	    Archived: boolean;
	    CreatedAt: time.Time;
	
	    static createFrom(source: any = {}) {
	        return new Project(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ID = source["ID"];
	        this.Name = source["Name"];
	        this.Color = source["Color"];
	        this.EstimateMinutes = source["EstimateMinutes"];
	        this.Archived = source["Archived"];
	        this.CreatedAt = this.convertValues(source["CreatedAt"], time.Time);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Rule {
	    ID: number;
	    PatternType: string;
	    Pattern: string;
	    ProjectID: number;
	    TaskID?: number;
	    Priority: number;
	
	    static createFrom(source: any = {}) {
	        return new Rule(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ID = source["ID"];
	        this.PatternType = source["PatternType"];
	        this.Pattern = source["Pattern"];
	        this.ProjectID = source["ProjectID"];
	        this.TaskID = source["TaskID"];
	        this.Priority = source["Priority"];
	    }
	}
	export class Task {
	    ID: number;
	    ProjectID: number;
	    Name: string;
	    EstimateMinutes?: number;
	    Status: string;
	    CreatedAt: time.Time;
	
	    static createFrom(source: any = {}) {
	        return new Task(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ID = source["ID"];
	        this.ProjectID = source["ProjectID"];
	        this.Name = source["Name"];
	        this.EstimateMinutes = source["EstimateMinutes"];
	        this.Status = source["Status"];
	        this.CreatedAt = this.convertValues(source["CreatedAt"], time.Time);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}


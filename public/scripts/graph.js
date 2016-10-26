$(document).ready(function(){
	
var incoming = $('.data-json').val();
var data = JSON.parse(incoming);
var incoming_dots = $('.data-json-dots').val();
var dots = JSON.parse(incoming_dots);
var margin = { top: 20, right: 80, bottom: 30, left: 50};
var width = 960 - margin.left - margin.right;
var height = 500 - margin.top - margin.bottom;
var formatCurrency = function(d) { return "$" + formatValue(d); };
function getDate(d) {
	return new Date(d);
}

var x = d3.time.scale().range([0, width]);

var y = d3.scale.linear().range([height, 0]);

var color = d3.scale.category10();

var xAxis = d3.svg.axis().scale(x).orient("bottom");

var yAxis = d3.svg.axis().scale(y).orient("left");

var line = d3.svg.line().interpolate("basis").x(function (d) {
    return x(getDate(d.date));
}).y(function (d) {
    return y(d.close);
});

var svg = d3.select("#chart")
.append("svg").attr("width", width + margin.left + margin.right)
.attr("height", height + margin.top + margin.bottom).append("g")
.attr("transform", "translate(" + margin.left + "," + margin.top + ")");

color.domain(data.map(function (d) { return d.key; }));

x.domain([
    d3.min(data, function(c) { return d3.min(c.values, function(v) { return getDate(v.date); }); }),
    d3.max(data, function(c) { return d3.max(c.values, function(v) { return getDate(v.date); }); })
]);
y.domain([
    d3.min(data, function(c) { return d3.min(c.values, function(v) { return v.close; }); }),
    d3.max(data, function(c) { return d3.max(c.values, function(v) { return v.close; }); })
]);

svg.append("g").attr("class", "x axis")
.attr("transform", "translate(0," + height + ")").call(xAxis);

svg.append("g").attr("class", "y axis")
.call(yAxis)
.append("text")
.attr("transform", "rotate(-90)")
.attr("y", 6).attr("dy", ".71em")
.style("text-anchor", "end")
.text("$tock price");

var stock = svg.selectAll(".stock")
.data(data)
.enter().append("g")
.attr("class", "stock");

var path = svg.selectAll(".stock")
.append("path")
.attr("class", "line")
.attr("d", function (d) {
    return line(d.values);
}).style("stroke", function (d) {
    return color(d.key);
});

var thispath = path[0];
for (var i = 0; i < thispath.length; i++) {
	var totalLength = thispath[i].getTotalLength();
	d3.select(thispath[i])
	.attr("stroke-dasharray", totalLength + " " + totalLength )
	.attr("stroke-dashoffset", totalLength)
	.transition().duration(2000).ease("linear").attr("stroke-dashoffset", 0)
}

stock.append("text").datum(function (d) {
	return {
		name: d.key,
		date: getDate(d.values[d.values.length - 1].date),
		value: d.values[d.values.length - 1].close
    };
}).attr("transform", function (d) {
	return "translate(" + x(getDate(d.date)) + "," + y(d.value) + ")";
}).attr("x", 3).attr("dy", ".35em").text(function (d) {
	return d.name;
});

var dot = svg.selectAll(".dot")
.data(dots)
.enter().append("svg:circle")
.attr("class", "dot")
.attr("cx", function(d) {
	return x(getDate(d.date)) 
})
.attr("cy", function(d) { 
	return y(d.close) 
})
.attr("r", 4)
.on("mouseover", function(d){
	var getThisDate = getDate(d.date);
	var displayDate = ''+getThisDate.getMonth()+'/'+getThisDate.getDate()+'/'+getThisDate.getFullYear()+'';
	var displayVal = '$'+d.close.toFixed(2);
	$('.tt').html("<div class='row'><div class='name col-xs-6' id='"+d.symbol+"'>"+d.symbol+"</div><div class='col-xs-6'>Volume:</div><div class='date col-xs-6'>"+displayDate+"</div><div class='col-xs-6'>"+d.volume+"</div><div class='close col-xs-12'>"+displayVal+"</div></div><div class='row'><div class='col-xs-6'>Open: $"+d.open.toFixed(2)+"</div><div class='col-xs-6'>High: $"+d.high.toFixed(2)+"</div></div>");
	$('.tt').show();
	d3.select(this).style("opacity", 1);
}).on("mousemove", function(d){
	var xPosition = d3.mouse(this)[0] + margin.left;
	var yPosition = d3.mouse(this)[1] + margin.top + 20;
	if (yPosition > height-(margin.bottom+100)) {
		yPosition = yPosition - (margin.bottom+100)
	}
	$(".tt").css({"left": xPosition+"px", "top": yPosition+"px"})
}).on("mouseout", function(d){
	d3.select(this).style("opacity", 0);
	$(".tt").hide();
});

});

//credit: http://bl.ocks.org/atmccann/8966400, http://bl.ocks.org/mbostock/3884955, http://stackoverflow.com/a/20017009/3530394
//http://codepen.io/pdillon/pen/bEgmA, http://codepen.io/jayarjo/pen/gzfyj?editors=0010
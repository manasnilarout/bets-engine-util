package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"

	_ "github.com/joho/godotenv/autoload"
)

func main() {
	fmt.Println("Starting the application...")
	iplSquadAPI := fmt.Sprintf("https://www.goalserve.com/getfeed/%s/cricketfixtures/india/ipl_squads?json=1", os.Getenv("GOALSERVE_TOKEN"))
	response, err := http.Get(iplSquadAPI)

	if err != nil {
		fmt.Printf("The HTTP request failed with error %s\n", err)
	} else {
		data, _ := ioutil.ReadAll(response.Body)
		squad := []byte(data)
		var raw map[string]interface{}
		er := json.Unmarshal(squad, &raw)

		if er != nil {
			fmt.Printf("There was an error while parsing JSON %s\n", er)
		}

		fmt.Println("Writing the results in output file.")
		wErr := ioutil.WriteFile("squads/ipl_squad.json", squad, 0644)
		if wErr != nil {
			panic(err)
		}
		fmt.Println("Writing results finished.")
	}

	fmt.Println("Terminating the application...")
}
